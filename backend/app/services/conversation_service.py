
"""Firestore-backed conversations, strictly partitioned by authenticated UID with local dev fallback."""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from firebase_admin import firestore
from app.core.security import initialize_firebase_admin
from app.models.schemas import ChatMessage, AttachmentItem, WarningCard

logger = logging.getLogger("biotrajectory.conversation")

_in_memory_conversations: Dict[str, Dict[str, Any]] = {}

def _db():
    if not initialize_firebase_admin():
        return None
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
        cid = conversation_id or str(uuid.uuid4())
        if len(cid) > 128:
            raise ValueError("Invalid conversation ID.")

        db = _db()
        if db is None:
            if cid not in _in_memory_conversations:
                _in_memory_conversations[cid] = {
                    "conversationId": cid,
                    "userId": user_id,
                    "messages": [],
                    "reportIds": []
                }
            elif _in_memory_conversations[cid]["userId"] != user_id:
                raise PermissionError("Conversation does not belong to this account.")
            return ConversationSession(cid, user_id, self.get_history(cid, user_id))

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

        db = _db()
        if db is None:
            data = _in_memory_conversations.get(conversation_id, {})
            if data and data.get("userId") != user_id:
                raise PermissionError("Conversation does not belong to this account.")
            messages = []
            for item in (data.get("messages") or [])[-40:]:
                try:
                    messages.append(ChatMessage(**item))
                except Exception:
                    pass
            return messages

        snap = db.collection("chat_history").document(conversation_id).get()
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

        new_messages = [
            {"id": f"usr_{uuid.uuid4().hex}", "sender": "user", "text": user_text,
             "timestamp": user_timestamp, "attachments": [a.model_dump() if hasattr(a, "model_dump") else a for a in (attachments or [])]},
            {"id": f"asst_{uuid.uuid4().hex}", "sender": "assistant", "text": assistant_text,
             "timestamp": assistant_timestamp, "warningCard": warning_card.model_dump() if hasattr(warning_card, "model_dump") else warning_card}
        ]

        db = _db()
        if db is None:
            if conversation_id not in _in_memory_conversations:
                _in_memory_conversations[conversation_id] = {"conversationId": conversation_id, "userId": user_id, "messages": [], "reportIds": []}
            elif _in_memory_conversations[conversation_id]["userId"] != user_id:
                raise PermissionError("Conversation does not belong to this account.")
            existing = _in_memory_conversations[conversation_id].get("messages", [])
            _in_memory_conversations[conversation_id]["messages"] = (existing + new_messages)[-40:]
            return conversation_id

        ref = db.collection("chat_history").document(conversation_id)
        snap = ref.get()
        if not snap.exists or (snap.to_dict() or {}).get("userId") != user_id:
            raise PermissionError("Conversation does not belong to this account.")
        existing = (snap.to_dict() or {}).get("messages") or []
        ref.update({"messages": (existing + new_messages)[-40:], "updated_at": firestore.SERVER_TIMESTAMP})
        return conversation_id

    def get_report_ids(self, conversation_id: str, user_id: str):
        db = _db()
        if db is None:
            data = _in_memory_conversations.get(conversation_id, {})
            if data and data.get("userId") != user_id:
                raise PermissionError("Conversation does not belong to this account.")
            return data.get("reportIds") or []

        snap = db.collection("chat_history").document(conversation_id).get()
        if not snap.exists:
            return []
        data = snap.to_dict() or {}
        if data.get("userId") != user_id:
            raise PermissionError("Conversation does not belong to this account.")
        return data.get("reportIds") or []

    def set_report_ids(self, conversation_id: str, user_id: str, report_ids):
        db = _db()
        if db is None:
            if conversation_id in _in_memory_conversations:
                _in_memory_conversations[conversation_id]["reportIds"] = list(dict.fromkeys(report_ids))[:5]
            return

        ref = db.collection("chat_history").document(conversation_id)
        snap = ref.get()
        if not snap.exists or (snap.to_dict() or {}).get("userId") != user_id:
            raise PermissionError("Conversation does not belong to this account.")
        ref.update({"reportIds": list(dict.fromkeys(report_ids))[:5], "updated_at": firestore.SERVER_TIMESTAMP})

    def delete_conversation(self, conversation_id: str, user_id: str):
        db = _db()
        if db is None:
            if conversation_id in _in_memory_conversations and _in_memory_conversations[conversation_id]["userId"] == user_id:
                del _in_memory_conversations[conversation_id]
            return

        ref = db.collection("chat_history").document(conversation_id)
        snap = ref.get()
        if not snap.exists:
            return
        if (snap.to_dict() or {}).get("userId") != user_id:
            raise PermissionError("Conversation does not belong to this account.")
        ref.delete()

    def prune_expired(self, max_idle_seconds=172800):
        return None


conversation_service = ConversationService()
