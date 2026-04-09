"""
POST /api/lead — accepts a submission from the website's contact form and
creates a row in the Airtable Clients table tagged Source = "Website Form".
"""
from fastapi import APIRouter
from app.models.schemas import LeadRequest, LeadResponse
from app.services.airtable_client import clients_table

router = APIRouter()


@router.post("/api/lead")
async def create_lead(req: LeadRequest) -> LeadResponse:
    fields: dict = {
        "Name": req.name.strip(),
        "Phone": req.phone.strip(),
        "Status": "New",
        "Channel": "website",
        "Source": req.source or "Website Form",
        "Converted": False,
    }
    if req.email:
        fields["Email"] = req.email.strip()
    if req.message:
        fields["Situation"] = req.message.strip()

    try:
        rec = clients_table().create(fields)
        return LeadResponse(ok=True, id=rec["id"])
    except Exception as e:
        print(f"[lead] Airtable create failed: {e}")
        return LeadResponse(ok=False, error="Could not save lead. Please try again.")
