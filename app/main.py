"""
FastAPI application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.api.health import router as health_router
from app.api.clients import router as clients_router
from app.api.chat import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown hooks."""
    print(f"[clientchatbot] Starting up (AI provider: {settings.ai_provider})")
    yield
    # Shutdown: flush any buffered messages
    print("[clientchatbot] Shutting down — flushing message buffers...")
    try:
        from app.services.memory import conversation_buffer
        await conversation_buffer.flush_all()
    except Exception as e:
        print(f"[clientchatbot] Flush error on shutdown: {e}")


app = FastAPI(
    title="Client Chatbot",
    description="AI-powered law firm client chatbot",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
origins = settings.cors_origins.split(",") if settings.cors_origins != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router)
app.include_router(clients_router)
app.include_router(chat_router)

# Static files (widget.js, embed.html, etc.)
# Routes are registered unconditionally; file lookup tries multiple locations
# so it works both locally and on Vercel's serverless runtime.
from fastapi.responses import FileResponse, JSONResponse, Response

_CANDIDATE_ROOTS = [
    Path(__file__).parent.parent / "public",         # local dev (project_root/public)
    Path(__file__).parent.parent / "api" / "public", # bundled next to the lambda
    Path("/var/task/public"),                        # vercel lambda root
    Path("/var/task/api/public"),                    # vercel lambda api/public
    Path(__file__).parent / "public",                # last-ditch fallback
]


def _find_static(filename: str) -> Path | None:
    for root in _CANDIDATE_ROOTS:
        candidate = root / filename
        if candidate.exists():
            return candidate
    return None


@app.get("/")
async def serve_embed():
    path = _find_static("embed.html")
    if path:
        return FileResponse(str(path))
    return JSONResponse({"message": "Client Chatbot API", "docs": "/docs"})


@app.get("/widget.js")
async def serve_widget():
    path = _find_static("widget.js")
    if path:
        return FileResponse(str(path), media_type="application/javascript")
    return Response("// widget.js not found in deployment", status_code=404, media_type="application/javascript")


@app.get("/embed.html")
async def serve_embed_html():
    path = _find_static("embed.html")
    if path:
        return FileResponse(str(path))
    return JSONResponse({"error": "embed.html not found"}, status_code=404)
