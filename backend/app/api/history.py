
"""Authenticated Firestore conversation history."""

from typing import Any, Dict

from fastapi import APIRouter, Query, Depends, HTTPException

from app.models.schemas import HistoryResponse
from app.services.conversation_service import conversation_service
from app.core.security import get_current_user

router = APIRouter(prefix="/api", tags=["History"])


@router.get("/history", response_model=HistoryResponse)
async def get_conversation_history(
    conversation_id: str = Query(..., min_length=8, max_length=128),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        messages = conversation_service.get_history(
            conversation_id,
            user_id=current_user["uid"]
        )
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail="Conversation does not belong to your account."
        )

    return HistoryResponse(
        conversation_id=conversation_id,
        messages=messages,
        total_messages=len(messages)
    )


@router.delete("/history")
async def delete_conversation_history(
    conversation_id: str = Query(..., min_length=8, max_length=128),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        conversation_service.delete_conversation(
            conversation_id,
            current_user["uid"]
        )
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail="Conversation does not belong to your account."
        )

    return {
        "success": True,
        "conversation_id": conversation_id
    }
