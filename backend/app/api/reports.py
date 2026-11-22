
"""Consent-gated PDF extraction for the authenticated patient's AI assistant."""

import io
import uuid
import logging

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from pypdf import PdfReader
from firebase_admin import firestore

from app.core.security import (
    get_current_user,
    initialize_firebase_admin,
)
from app.services.health_service import HealthDataService

logger = logging.getLogger("biotrajectory.ai_reports")

router = APIRouter(prefix="/api/ai", tags=["AI Reports"])

MAX_BYTES = 8 * 1024 * 1024
MAX_PAGES = 30
MAX_TEXT = 60000


@router.post("/reports")
async def upload_ai_report(
    file: UploadFile = File(...),
    consent: bool = Form(...),
    current_user=Depends(get_current_user),
):
    uid = current_user["uid"]

    if consent is not True:
        raise HTTPException(
            status_code=400,
            detail="Explicit report-analysis consent is required.",
        )

    profile_consent = HealthDataService.get_profile_and_consent(uid)

    if not profile_consent["ai_consent"]:
        raise HTTPException(
            status_code=403,
            detail=(
                "Enable AI Assistant Analysis in your "
                "health privacy settings first."
            ),
        )

    filename = (file.filename or "").strip()

    if (
        not filename.lower().endswith(".pdf")
        or file.content_type not in (
            "application/pdf",
            "application/octet-stream",
        )
    ):
        raise HTTPException(
            status_code=415,
            detail="Only PDF reports are supported.",
        )

    raw = await file.read(MAX_BYTES + 1)

    if len(raw) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail="PDF exceeds the 8 MB upload limit.",
        )

    if not raw.startswith(b"%PDF"):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid PDF.",
        )

    try:
        reader = PdfReader(io.BytesIO(raw), strict=False)

        if len(reader.pages) > MAX_PAGES:
            raise HTTPException(
                status_code=413,
                detail=f"PDF exceeds the {MAX_PAGES}-page limit.",
            )

        extracted = "\n".join(
            (page.extract_text() or "")
            for page in reader.pages
        ).strip()

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not read this PDF. It may be scanned "
                "or password-protected."
            ),
        )

    if not extracted:
        raise HTTPException(
            status_code=422,
            detail=(
                "No selectable text was found. "
                "OCR for scanned PDFs is not enabled yet."
            ),
        )

    extracted = extracted[:MAX_TEXT]
    report_id = uuid.uuid4().hex

    if not initialize_firebase_admin():
        HealthDataService._dev_reports[report_id] = {
            "ownerUid": uid,
            "fileName": filename[:255],
            "mimeType": "application/pdf",
            "sizeBytes": len(raw),
            "pageCount": len(reader.pages),
            "extractedText": extracted,
        }
        return {
            "report_id": report_id,
            "file_name": filename,
            "page_count": len(reader.pages),
            "characters_extracted": len(extracted),
            "message": (
                "PDF text successfully extracted and indexed for AI Assistant analysis."
            ),
        }

    ref = (
        firestore.client()
        .collection("patient_records")
        .document(uid)
        .collection("ai_reports")
        .document(report_id)
    )

    ref.set({
        "ownerUid": uid,
        "fileName": filename[:255],
        "mimeType": "application/pdf",
        "sizeBytes": len(raw),
        "pageCount": len(reader.pages),
        "extractedText": extracted,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "consentConfirmedAt": firestore.SERVER_TIMESTAMP,
    })

    return {
        "report_id": report_id,
        "file_name": filename,
        "page_count": len(reader.pages),
        "characters_extracted": len(extracted),
        "message": (
            "PDF text extracted and stored in your private "
            "Firestore report collection."
        ),
    }
