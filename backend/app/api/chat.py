
"""Authenticated BioTrajectory AI chat endpoint."""

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import ChatRequest, ChatResponse
from app.services.safety_service import ClinicalSafetyService
from app.services.conversation_service import conversation_service
from app.services.gemini_service import gemini_service
from app.services.health_service import HealthDataService
from app.core.security import get_current_user
from app.utils.helpers import get_current_time_str, sanitize_text

logger = logging.getLogger("biotrajectory.chat")

router = APIRouter(prefix="/api", tags=["Chat"])


@router.post("/chat", response_model=ChatResponse)
async def handle_chat(
    payload: ChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["uid"]

    clean_message = sanitize_text(payload.message)

    if not clean_message:
        raise HTTPException(
            status_code=422,
            detail="Message content cannot be blank."
        )

    try:
        session = conversation_service.get_or_create(
            payload.conversation_id,
            user_id=user_id
        )
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail="This conversation does not belong to your account."
        )

    is_emergency, emergency_text, emergency_card = (
        ClinicalSafetyService.evaluate_emergency(clean_message)
    )

    current_time = get_current_time_str()

    if is_emergency and emergency_text:
        conversation_service.append_turn(
            session.conversation_id,
            clean_message,
            emergency_text,
            current_time,
            current_time,
            payload.attachments,
            emergency_card,
            user_id
        )

        return ChatResponse(
            response=emergency_text,
            text=emergency_text,
            conversation_id=session.conversation_id,
            is_emergency=True,
            warningCard=emergency_card,
            timestamp=current_time,
            model_used="clinical_safety_emergency_protocol"
        )

    # Never trust browser-supplied conversation history.
    # Load only server-owned history.
    history = conversation_service.get_history(
        session.conversation_id,
        user_id=user_id
    )

    health_result = HealthDataService.retrieve_authorized_health_records(
        user_id,
        True
    )

    report_ids = (
        payload.report_ids
        if payload.report_ids is not None
        else conversation_service.get_report_ids(
            session.conversation_id,
            user_id
        )
    )

    owned_reports = []

    if report_ids:
        if not health_result.get("available"):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Enable AI Assistant Analysis in your "
                    "health privacy settings before sharing reports."
                )
            )

        owned_reports = HealthDataService.get_owned_reports(
            user_id,
            report_ids
        )

        if len(owned_reports) != len(set(report_ids)):
            raise HTTPException(
                status_code=404,
                detail="One or more reports were not found in your account."
            )

        conversation_service.set_report_ids(
            session.conversation_id,
            user_id,
            report_ids
        )

    context_notes = HealthDataService.build_context(
        health_result,
        owned_reports
    )

    response_text, warning_card, model_used = (
        await gemini_service.generate_response(
            message=clean_message,
            history=history,
            user_consent=bool(health_result.get("available")),
            attachments=payload.attachments,
            context_notes=context_notes
        )
    )

    response_text = ClinicalSafetyService.enforce_educational_boundaries(
        response_text
    )

    conversation_service.append_turn(
        session.conversation_id,
        clean_message,
        response_text,
        current_time,
        current_time,
        payload.attachments,
        warning_card,
        user_id
    )

    return ChatResponse(
        response=response_text,
        text=response_text,
        conversation_id=session.conversation_id,
        is_emergency=False,
        warningCard=warning_card,
        timestamp=current_time,
        model_used=model_used
    )
