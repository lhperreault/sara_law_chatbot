"""
POST /api/calculator        — anonymous submission of settlement calculator state
POST /api/calculator/contact — attach name + phone to an existing submission
                                (upgrades Status from Anonymous → Lead and creates
                                a linked row in the Clients table)
"""
from fastapi import APIRouter
from app.models.schemas import (
    CalculatorSubmission,
    CalculatorContactUpdate,
    CalculatorResponse,
)
from app.services.airtable_client import calculator_table, clients_table

router = APIRouter()


@router.post("/api/calculator")
async def create_submission(req: CalculatorSubmission) -> CalculatorResponse:
    fields: dict = {
        "Language": req.language or "en",
        "Status": "Anonymous",
    }
    if req.type_of_accident:
        fields["Type of Accident"] = req.type_of_accident
    if req.other_party_fault_pct is not None:
        fields["Other Party Fault %"] = req.other_party_fault_pct
    if req.current_medical_bills:
        fields["Current Medical Bills"] = req.current_medical_bills
    if req.future_medical:
        fields["Future Medical"] = req.future_medical
    if req.property_damage:
        fields["Property Damage"] = req.property_damage
    if req.lost_wages:
        fields["Lost Wages"] = req.lost_wages
    if req.future_lost_earnings:
        fields["Future Lost Earnings"] = req.future_lost_earnings
    if req.additional_losses:
        fields["Additional Losses"] = req.additional_losses
    if req.injury_severity:
        fields["Injury Severity"] = req.injury_severity
    if req.impact_factors:
        fields["Impact Factors"] = req.impact_factors
    if req.estimated_low is not None:
        fields["Estimated Low"] = req.estimated_low
    if req.estimated_high is not None:
        fields["Estimated High"] = req.estimated_high
    if req.page_url:
        fields["Page URL"] = req.page_url

    try:
        rec = calculator_table().create(fields)
        return CalculatorResponse(ok=True, id=rec["id"])
    except Exception as e:
        print(f"[calculator] create failed: {e}")
        return CalculatorResponse(ok=False, error="Could not save submission")


@router.post("/api/calculator/contact")
async def attach_contact(req: CalculatorContactUpdate) -> CalculatorResponse:
    try:
        # 1. Create a real Clients row tagged as Website Form lead.
        client_fields = {
            "Name": req.name.strip(),
            "Phone": req.phone.strip(),
            "Status": "New",
            "Channel": "website",
            "Source": "Website Form",
            "Converted": False,
        }
        if req.email:
            client_fields["Email"] = req.email.strip()
        client = clients_table().create(client_fields)
        client_id = client["id"]

        # 2. Update the calculator submission: name/phone/email + link to client.
        update_fields = {
            "Name": req.name.strip(),
            "Phone": req.phone.strip(),
            "Status": "Lead",
            "Client": [client_id],
        }
        if req.email:
            update_fields["Email"] = req.email.strip()
        calculator_table().update(req.submission_id, update_fields)

        return CalculatorResponse(ok=True, id=client_id)
    except Exception as e:
        print(f"[calculator] contact update failed: {e}")
        return CalculatorResponse(ok=False, error="Could not save contact info")
