
"""Short-lived patient QR consent workflow.

Security:
- QR contains only an opaque, random token.
- Only the SHA-256 hash of the token is stored.
- QR sessions expire after 5 minutes and can be used once.
- Only approved doctors can request access.
- Patient consent is mandatory.
- Approved access expires after 30 minutes.
- Patients can revoke access.
- Health-reading access is audited.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore
from pydantic import BaseModel, Field

from app.core.security import (
    get_current_user,
    initialize_firebase_admin,
)


router = APIRouter(
    prefix="/api/qr",
    tags=["patient-qr-consent"],
)


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def db():
    """Return the initialized Firestore client."""
    if not initialize_firebase_admin():
        raise HTTPException(
            status_code=503,
            detail="Firebase Admin is not configured.",
        )

    return firestore.client()


def now():
    """Return current UTC time."""
    return datetime.now(timezone.utc)


def hash_token(token: str) -> str:
    """Hash the raw QR token before using it as a document ID."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def require_patient(user: Dict[str, Any]):
    """Allow only patient accounts to manage consent."""
    if user.get("role", "USER") != "USER":
        raise HTTPException(
            status_code=403,
            detail="Patient account required.",
        )


def require_doctor(user: Dict[str, Any]):
    """Verify doctor role and current approval status."""
    if user.get("role") != "DOCTOR":
        raise HTTPException(
            status_code=403,
            detail="Verified doctor access is required.",
        )

    profile = (
        db()
        .collection("approved_doctors")
        .document(user["uid"])
        .get()
    )

    if (
        not profile.exists
        or (profile.to_dict() or {}).get("status") != "APPROVED"
    ):
        raise HTTPException(
            status_code=403,
            detail="Doctor approval could not be verified.",
        )


def get_request_ref(database, request_id: str):
    return (
        database
        .collection("qr_access_requests")
        .document(request_id)
    )


# ---------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------

class ScanPayload(BaseModel):
    token: str = Field(
        min_length=20,
        max_length=256,
    )


class ConsentPayload(BaseModel):
    approved: bool


# ---------------------------------------------------------------------
# 1. Patient creates QR session
# ---------------------------------------------------------------------

@router.post("/sessions")
async def create_session(
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Create a QR token valid for 5 minutes and one use only."""

    require_patient(user)

    database = db()

    token = secrets.token_urlsafe(32)
    token_hash = hash_token(token)

    created_at = now()
    expires_at = created_at + timedelta(minutes=5)

    database.collection("qr_sessions").document(token_hash).create({
        "patientUid": user["uid"],
        "status": "ACTIVE",
        "createdAt": created_at,
        "expiresAt": expires_at,
    })

    # Return the raw token only to the patient.
    # Never store the raw token in Firestore.
    return {
        "token": token,
        "expiresAt": expires_at.isoformat(),
        "expiresInSeconds": 300,
    }


# ---------------------------------------------------------------------
# 2. Approved doctor scans patient QR
# ---------------------------------------------------------------------

@router.post("/scan", status_code=201)
async def scan_patient_qr(
    payload: ScanPayload,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Atomically redeem a one-time patient QR challenge."""

    require_doctor(user)

    database = db()
    token_hash = hash_token(payload.token)

    session_ref = (
        database.collection("qr_sessions")
        .document(token_hash)
    )

    doctor_ref = (
        database.collection("approved_doctors")
        .document(user["uid"])
    )

    # Allocate the ID outside the transaction.
    # Firestore may retry the transaction callback.
    request_ref = (
        database.collection("qr_access_requests")
        .document()
    )

    created_at = now()
    request_expires = created_at + timedelta(minutes=5)

    transaction = database.transaction()

    @firestore.transactional
    def redeem_session(transaction):

        # All reads must happen before writes.
        session_snap = session_ref.get(
            transaction=transaction
        )

        doctor_snap = doctor_ref.get(
            transaction=transaction
        )

        if not session_snap.exists:
            raise HTTPException(
                status_code=404,
                detail="QR token is invalid or expired.",
            )

        if not doctor_snap.exists:
            raise HTTPException(
                status_code=403,
                detail="Doctor approval could not be verified.",
            )

        doctor_profile = doctor_snap.to_dict() or {}

        if doctor_profile.get("status") != "APPROVED":
            raise HTTPException(
                status_code=403,
                detail="Doctor approval is no longer active.",
            )

        session = session_snap.to_dict() or {}
        expires_at = session.get("expiresAt")

        if (
            session.get("status") != "ACTIVE"
            or not expires_at
            or expires_at <= created_at
        ):
            raise HTTPException(
                status_code=410,
                detail="QR token has expired or was already used.",
            )

        patient_uid = session.get("patientUid")

        if not patient_uid:
            raise HTTPException(
                status_code=400,
                detail="QR session has invalid patient information.",
            )

        transaction.create(
            request_ref,
            {
                "patientUid": patient_uid,
                "doctorUid": user["uid"],
                "doctorName": (
                    doctor_profile.get("full_name")
                    or user.get("name")
                    or "Verified doctor"
                ),
                "status": "PENDING",
                "createdAt": created_at,
                "expiresAt": request_expires,
                "sessionHash": token_hash,
            },
        )

        transaction.update(
            session_ref,
            {
                "status": "REQUESTED",
                "requestId": request_ref.id,
                "requestedAt": created_at,
                "requestedBy": user["uid"],
            },
        )

    redeem_session(transaction)

    return {
        "success": True,
        "requestId": request_ref.id,
        "status": "PENDING",
        "message": "Consent request sent to patient.",
    }


# ---------------------------------------------------------------------
# 3. Patient views pending consent requests
# ---------------------------------------------------------------------

@router.get("/requests/pending")
async def pending_requests(
    user: Dict[str, Any] = Depends(get_current_user),
):
    require_patient(user)

    database = db()

    docs = (
        database.collection("qr_access_requests")
        .where("patientUid", "==", user["uid"])
        .stream()
    )

    current_time = now()
    requests = []

    for doc in docs:
        item = doc.to_dict() or {}
        expires_at = item.get("expiresAt")

        if (
            item.get("status") == "PENDING"
            and expires_at
            and expires_at > current_time
        ):
            created_at = item.get("createdAt")

            requests.append({
    "id": doc.id,
    "doctorName": item.get(
        "doctorName",
        "Verified doctor",
    ),
    "createdAt": (
        created_at.isoformat()
        if hasattr(created_at, "isoformat")
        else None
    ),
})

    return {
        "requests": requests,
    }


# ---------------------------------------------------------------------
# 4. Patient approves or denies consent
# ---------------------------------------------------------------------

@router.post("/requests/{request_id}/consent")
async def decide_consent(
    request_id: str,
    payload: ConsentPayload,
    user: Dict[str, Any] = Depends(get_current_user),
):
    require_patient(user)

    database = db()

    request_ref = get_request_ref(
        database,
        request_id,
    )

    transaction = database.transaction()

    decided_at = now()
    grant_expires = decided_at + timedelta(minutes=30)

    session_ref = None

    @firestore.transactional
    def process_consent(transaction):

        # Read request first.
        request_snap = request_ref.get(
            transaction=transaction
        )

        if not request_snap.exists:
            raise HTTPException(
                status_code=404,
                detail="Consent request not found.",
            )

        item = request_snap.to_dict() or {}

        if item.get("patientUid") != user["uid"]:
            raise HTTPException(
                status_code=403,
                detail="You cannot approve another patient's request.",
            )

        expires_at = item.get("expiresAt")

        if (
            item.get("status") != "PENDING"
            or not expires_at
            or expires_at <= decided_at
        ):
            raise HTTPException(
                status_code=410,
                detail="Consent request has expired or was already processed.",
            )

        session_hash = item.get("sessionHash")

        if not payload.approved and session_hash:
            session_ref = (
                database.collection("qr_sessions")
                .document(session_hash)
            )

            session_snap = session_ref.get(
                transaction=transaction
            )

            if not session_snap.exists:
                raise HTTPException(
                    status_code=409,
                    detail="Associated QR session was not found.",
                )

        if payload.approved:
            transaction.update(
                request_ref,
                {
                    "status": "APPROVED",
                    "approvedAt": decided_at,
                    "grantExpiresAt": grant_expires,
                },
            )

        else:
            transaction.update(
                request_ref,
                {
                    "status": "DENIED",
                    "decidedAt": decided_at,
                },
            )

            if session_ref:
                transaction.update(
                    session_ref,
                    {
                        "status": "DENIED",
                    },
                )

    process_consent(transaction)

    if payload.approved:
        return {
            "success": True,
            "status": "APPROVED",
            "expiresAt": grant_expires.isoformat(),
        }

    return {
        "success": True,
        "status": "DENIED",
    }


# ---------------------------------------------------------------------
# 5. Doctor checks consent status
# ---------------------------------------------------------------------

@router.get("/doctor/requests/{request_id}")
async def doctor_request_status(
    request_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    require_doctor(user)

    database = db()

    request_ref = get_request_ref(
        database,
        request_id,
    )

    transaction = database.transaction()
    checked_at = now()

    @firestore.transactional
    def check_status(transaction):

        snap = request_ref.get(
            transaction=transaction
        )

        if not snap.exists:
            raise HTTPException(
                status_code=404,
                detail="Request not found.",
            )

        item = snap.to_dict() or {}

        if item.get("doctorUid") != user["uid"]:
            raise HTTPException(
                status_code=404,
                detail="Request not found.",
            )

        status = item.get("status")
        expires_at = item.get("grantExpiresAt")

        if (
            status == "APPROVED"
            and expires_at
            and expires_at <= checked_at
        ):
            transaction.update(
                request_ref,
                {
                    "status": "EXPIRED",
                    "expiredAt": checked_at,
                },
            )

            return {
                "status": "EXPIRED",
                "expiresAt": expires_at.isoformat(),
            }

        return {
            "status": status,
            "expiresAt": (
                expires_at.isoformat()
                if expires_at
                else None
            ),
        }

    return check_status(transaction)


# ---------------------------------------------------------------------
# 6. Doctor accesses patient health readings
# ---------------------------------------------------------------------

@router.get("/doctor/requests/{request_id}/readings")
async def authorized_readings(
    request_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Read health records only under an active patient consent grant."""

    require_doctor(user)

    database = db()

    request_ref = get_request_ref(
        database,
        request_id,
    )

    accessed_at = now()

    audit_ref = (
        database.collection("qr_access_audit")
        .document()
    )

    transaction = database.transaction()

    @firestore.transactional
    def read_authorized_records(transaction):

        # Verify consent inside the transaction.
        grant_snap = request_ref.get(
            transaction=transaction
        )

        if not grant_snap.exists:
            raise HTTPException(
                status_code=404,
                detail="Request not found.",
            )

        grant = grant_snap.to_dict() or {}

        if grant.get("doctorUid") != user["uid"]:
            raise HTTPException(
                status_code=403,
                detail="This request does not belong to this doctor.",
            )

        if grant.get("status") != "APPROVED":
            raise HTTPException(
                status_code=403,
                detail="Patient consent is not active.",
            )

        grant_expires = grant.get("grantExpiresAt")

        if not grant_expires or grant_expires <= accessed_at:
            transaction.update(
                request_ref,
                {
                    "status": "EXPIRED",
                    "expiredAt": accessed_at,
                },
            )

            return None

        patient_uid = grant.get("patientUid")

        if not patient_uid:
            raise HTTPException(
                status_code=400,
                detail="Patient information is missing.",
            )

        readings_ref = (
            database.collection("patient_records")
            .document(patient_uid)
            .collection("readings")
        )

# Fetch readings using the Firestore collection stream.
# Consent has already been verified inside the transaction.
        record_snaps = list(readings_ref.stream())

        readings = []

        for record in record_snaps:
            data = record.to_dict() or {}
            measured_at = data.get("measuredAt")

            readings.append({
                "id": record.id,
                "type": data.get("type"),
                "values": data.get("values"),
                "measuredAt": (
                    measured_at.isoformat()
                    if hasattr(measured_at, "isoformat")
                    else measured_at
                ),
            })

        # Audit entry is committed with the authorized read.
        transaction.create(
            audit_ref,
            {
                "patientUid": patient_uid,
                "doctorUid": user["uid"],
                "requestId": request_id,
                "action": "READ_HEALTH_READINGS",
                "accessedAt": accessed_at,
            },
        )

        return {
            "patientUid": patient_uid,
            "readings": readings,
            "expiresAt": grant_expires.isoformat(),
        }

    result = read_authorized_records(transaction)

    if result is None:
        raise HTTPException(
            status_code=410,
            detail="Patient consent has expired.",
        )

    return result


# ---------------------------------------------------------------------
# 7. Patient revokes consent
# ---------------------------------------------------------------------

@router.post("/requests/{request_id}/revoke")
async def revoke_consent(
    request_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    require_patient(user)

    database = db()

    request_ref = get_request_ref(
        database,
        request_id,
    )

    transaction = database.transaction()
    revoked_at = now()

    @firestore.transactional
    def revoke_access(transaction):

        request_snap = request_ref.get(
            transaction=transaction
        )

        if not request_snap.exists:
            raise HTTPException(
                status_code=404,
                detail="Consent grant not found.",
            )

        item = request_snap.to_dict() or {}

        if item.get("patientUid") != user["uid"]:
            raise HTTPException(
                status_code=404,
                detail="Consent grant not found.",
            )

        if item.get("status") not in {
            "APPROVED",
            "PENDING",
        }:
            raise HTTPException(
                status_code=409,
                detail="This request is no longer active.",
            )

        session_ref = None

        session_hash = item.get("sessionHash")

        if session_hash:
            session_ref = (
                database.collection("qr_sessions")
                .document(session_hash)
            )

            session_snap = session_ref.get(
                transaction=transaction
            )

        transaction.update(
            request_ref,
            {
                "status": "REVOKED",
                "revokedAt": revoked_at,
            },
        )

        if session_ref and session_snap.exists:
            transaction.update(
                session_ref,
                {
                    "status": "REVOKED",
                },
            )

    revoke_access(transaction)

    return {
        "success": True,
        "status": "REVOKED",
    }
