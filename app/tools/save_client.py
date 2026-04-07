"""
Tool: save_client_info — updates client record in Airtable.
"""
from typing import Dict, Any
from app.services import client_service


async def execute(client_id: str, args: Dict[str, Any]) -> Dict[str, str]:
    """Save or update client info gathered during conversation."""
    updates: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}

    if args.get("first_name"):
        updates["first_name"] = args["first_name"]
    if args.get("last_name"):
        updates["last_name"] = args["last_name"]
    if args.get("phone"):
        updates["phone"] = args["phone"]

    if args.get("intake_type"):
        metadata["intake_type"] = args["intake_type"]
    if args.get("situation_summary"):
        metadata["situation_summary"] = args["situation_summary"]
    if args.get("urgency"):
        metadata["urgency"] = args["urgency"]
    if args.get("notes"):
        metadata["notes"] = args["notes"]

    if metadata:
        updates["metadata"] = metadata

    if updates:
        await client_service.update_client(client_id, updates)

    return {"status": "saved"}
