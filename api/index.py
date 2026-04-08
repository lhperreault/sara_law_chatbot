"""
Vercel serverless entrypoint. Re-exports the FastAPI app from app/main.py
so Vercel's @vercel/python runtime can serve it as an ASGI app.
"""
from app.main import app  # noqa: F401
