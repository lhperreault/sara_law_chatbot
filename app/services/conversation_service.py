"""
Conversation service — create conversations, load/save messages in Airtable.
"""
import json
import uuid
from typing import Optional, List, Dict, Any
from pyairtable.formulas import match
from app.services.airtable_client import conversations_table, messages_table


def _convo_to_dict(rec: Dict[str, Any]) -> Dict[str, Any]:
    f = rec.get("fields", {})
    return {
        "id": rec["id"],
        "conversation_id": f.get("Conversation ID"),
        "practice_area": f.get("Practice Area"),
        "channel": f.get("Channel"),
        "status": f.get("Status"),
        "client_id": (f.get("Client") or [None])[0],
    }


async def create_conversation(
    client_id: str,
    practice_area: str,
    channel: str = "website",
    case_id: Optional[str] = None,  # kept for API compatibility, ignored
) -> Dict[str, Any]:
    fields = {
        "Conversation ID": str(uuid.uuid4()),
        "Practice Area": practice_area,
        "Channel": channel,
        "Status": "active",
        "Client": [client_id] if client_id else [],
    }
    rec = conversations_table().create(fields)
    return _convo_to_dict(rec)


async def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    if not conversation_id:
        return None
    try:
        rec = conversations_table().get(conversation_id)
        return _convo_to_dict(rec)
    except Exception:
        return None


async def get_recent_messages(
    conversation_id: str, limit: int = 20
) -> List[Dict[str, Any]]:
    """Get the most recent messages for a conversation, oldest-first."""
    if not conversation_id:
        return []
    tbl = messages_table()
    # Filter by linked Conversation record id via FIND on the linked-record array.
    # Simpler: pull by formula matching the conversation record id string.
    formula = f"FIND('{conversation_id}', ARRAYJOIN({{Conversation}}))"
    records = tbl.all(
        formula=formula,
        sort=["Created At"],
        max_records=limit,
    )
    out = []
    for r in records:
        f = r.get("fields", {})
        out.append(
            {
                "role": f.get("Role", "user"),
                "content": f.get("Content", ""),
                "tool_name": f.get("Tool Name"),
                "tool_args": f.get("Tool Args"),
                "tool_result": f.get("Tool Result"),
                "created_at": f.get("Created At"),
            }
        )
    return out


async def save_messages(
    conversation_id: str,
    messages: List[Dict[str, Any]],
) -> None:
    """Batch insert messages into Airtable."""
    if not messages or not conversation_id:
        return
    rows = []
    for msg in messages:
        fields: Dict[str, Any] = {
            "Message ID": str(uuid.uuid4()),
            "Role": msg.get("role", "user"),
            "Content": msg.get("content", "") or "",
            "Conversation": [conversation_id],
        }
        if msg.get("tool_name"):
            fields["Tool Name"] = msg["tool_name"]
        if msg.get("tool_args") is not None:
            fields["Tool Args"] = json.dumps(msg["tool_args"])
        if msg.get("tool_result") is not None:
            fields["Tool Result"] = json.dumps(msg["tool_result"])
        if msg.get("requires_review"):
            fields["Requires Review"] = True
        if msg.get("ai_provider"):
            fields["AI Provider"] = msg["ai_provider"]
        if msg.get("ai_model"):
            fields["AI Model"] = msg["ai_model"]
        if msg.get("token_count"):
            fields["Tokens"] = msg["token_count"]
        rows.append({"fields": fields})

    # pyairtable batch_create accepts list of field dicts
    messages_table().batch_create([r["fields"] for r in rows])


async def get_client_conversations(
    client_id: str, limit: int = 5
) -> List[Dict[str, Any]]:
    if not client_id:
        return []
    tbl = conversations_table()
    formula = f"FIND('{client_id}', ARRAYJOIN({{Client}}))"
    records = tbl.all(formula=formula, max_records=limit)
    return [_convo_to_dict(r) for r in records]
