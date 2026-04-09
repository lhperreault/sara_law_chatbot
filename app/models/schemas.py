"""
Pydantic models for API requests and responses.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID


# ─── Chat ────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    client_email: str
    message: str
    practice_area: str = "roque_law"
    # Client-side full history — the widget is the source of truth for memory,
    # the backend just builds the prompt and calls the LLM. Airtable writes
    # happen in the background for logging only.
    history: Optional[List[ChatMessage]] = None


class ClientInfo(BaseModel):
    id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    is_new: bool = False


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    suggestions: Optional[List[str]] = None
    requires_review: bool = False
    client: Optional[ClientInfo] = None


# ─── Client Lookup ───────────────────────────────────────────────────────────

class ClientLookupRequest(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    channel: str = "website"


class ClientLookupResponse(BaseModel):
    client: ClientInfo
    active_cases: List[Dict[str, Any]] = []
    conversation_id: Optional[str] = None


# ─── Website Form Lead ───────────────────────────────────────────────────────

class LeadRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    message: Optional[str] = None
    source: str = "Website Form"


class LeadResponse(BaseModel):
    ok: bool
    id: Optional[str] = None
    error: Optional[str] = None


# ─── AI Provider ─────────────────────────────────────────────────────────────

class AIChatResponse(BaseModel):
    content: str
    tool_calls: List[Dict[str, Any]] = []
    model: str
    provider: str
    usage: Dict[str, int] = {}
