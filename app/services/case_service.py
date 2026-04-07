"""
Case service — stubbed out. Roque Law intake doesn't use a cases table
(everything lives on the Clients row). Kept for API compatibility.
"""
from typing import Optional, List, Dict, Any


async def create_case(
    client_id: str,
    practice_area: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
) -> Dict[str, Any]:
    return {"id": None, "status": "not_implemented"}


async def get_active_cases(client_id: str) -> List[Dict[str, Any]]:
    return []


async def update_case(case_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    return {}
