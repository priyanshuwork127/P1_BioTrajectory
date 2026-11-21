
"""Firestore-backed conversations, strictly partitioned by authenticated UID."""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from firebase_admin import firestore
from app.core.security import initialize_firebase_admin
from app.models.schemas import ChatMessage, AttachmentItem, WarningCard

logger = logging.getLogger("biotrajectory.conversation")


def _db():
    if not initialize_firebase_admin():
        raise RuntimeError("Firebase Admin is not initialized.")
    return firestore.client()


class ConversationSession:
    def __init__(self, conversation_id: str, user_id: str, messages=None):
        self.conversation_id = conversation_id
        self.user_id = user_id
        self.messages = messages or []


class ConversationService:
    def get_or_create(self, conversation_id: Optional[str] = None, user_id: Optional[str] = None):
        if not user_id:
            raise ValueError("Authenticated user UID is required.")
        db = _db()
        cid = conversation_id or str(uuid.uuid4())
        if len(cid) > 128:
            raise ValueError("Invalid conversation ID.")
        ref = db.collection("chat_history").document(cid)
        snap = ref.get()
        if snap.exists and (snap.to_dict() or {}).get("userId") != user_id:
            raise PermissionError("Conversation does not belong to this account.")
        if not snap.exists:
            ref.create({"conversationId": cid, "userId": user_id, "messages": [],
                        "created_at": firestore.SERVER_TIMESTAMP, "updated_at": firestore.SERVER_TIMESTAMP})
        return ConversationSession(cid, user_id, self.get_history(cid, user_id))

    def get_history(self, conversation_id: str, user_id: Optional[str] = None) -> List[ChatMessage]:
        if not user_id:
            raise ValueError("Authenticated user UID is required.")
        snap = _db().collection("chat_history").document(conversation_id).get()
        if not snap.exists:
            return []
        data = snap.to_dict() or {}
        if data.get("userId") != user_id:
            raise PermissionError("Conversation does not belong to this account.")
        messages = []
        for item in (data.get("messages") or [])[-40:]:
            try:
                messages.append(ChatMessage(**item))
            except Exception:
                logger.warning("Skipping malformed stored chat message.")
        return messages

    def append_turn(self, conversation_id: str, user_text: str, assistant_text: str,
                    user_timestamp: str, assistant_timestamp: str,
                    attachments=None, warning_card=None, user_id: Optional[str] = None):
        if not user_id:
            raise ValueError("Authenticated user UID is required.")
        ref = _db().collection("chat_history").document(conversation_id)
        snap = ref.get()
        if not snap.exists or (snap.to_dict() or {}).get("userId") != user_id:
            raise PermissionError("Conversation does not belong to this account.")
        existing = (snap.to_dict() or {}).get("messages") or []
        new_messages = [
            {"id": f"usr_{uuid.uuid4().hex}", "sender": "user", "text": user_text,
             "timestamp": user_timestamp, "attachments": [a.model_dump() if hasattr(a, "model_dump") else a for a in (attachments or [])]},
            {"id": f"asst_{uuid.uuid4().hex}", "sender": "assistant", "text": assistant_text,
             "timestamp": assistant_timestamp, "warningCard": warning_card.model_dump() if hasattr(warning_card, "model_dump") else warning_card}
        ]
        ref.update({"messages": (existing + new_messages)[-40:], "updated_at": firestore.SERVER_TIMESTAMP})
        return conversation_id

    def get_report_ids(self, conversation_id: str, user_id: str):
        snap = _db().collection("chat_history").document(conversation_id).get()
        if not snap.exists:
            return []
        data = snap.to_dict() or {}
        if data.get("userId") != user_id:
            raise PermissionError("Conversation does not belong to this account.")
        return data.get("reportIds") or []

    def set_report_ids(self, conversation_id: str, user_id: str, report_ids):
        ref = _db().collection("chat_history").document(conversation_id)
        snap = ref.get()
        if not snap.exists or (snap.to_dict() or {}).get("userId") != user_id:
            raise PermissionError("Conversation does not belong to this account.")
        ref.update({"reportIds": list(dict.fromkeys(report_ids))[:5], "updated_at": firestore.SERVER_TIMESTAMP})

    def delete_conversation(self, conversation_id: str, user_id: str):
        ref = _db().collection("chat_history").document(conversation_id)
        snap = ref.get()
        if not snap.exists:
            return
        if (snap.to_dict() or {}).get("userId") != user_id:
            raise PermissionError("Conversation does not belong to this account.")
        ref.delete()

    def prune_expired(self, max_idle_seconds=172800):
        return None


conversation_service = ConversationService()
