"""
One-shot: add "Source" (singleSelect) and "Converted" (checkbox) fields to
the Clients table so leads from the website form are distinguishable from
chatbot leads, and the team can mark which ones converted.

Run once:  python scripts/add_lead_fields.py
"""
import os
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API_KEY = os.getenv("AIRTABLE_API_KEY")
BASE_ID = os.getenv("AIRTABLE_BASE_ID")
if not API_KEY or not BASE_ID:
    print("ERROR: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env")
    sys.exit(1)

H = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
META = f"https://api.airtable.com/v0/meta/bases/{BASE_ID}/tables"

r = requests.get(META, headers=H)
r.raise_for_status()
tables = r.json()["tables"]
clients = next((t for t in tables if t["name"] == "Clients"), None)
if not clients:
    print("ERROR: Clients table not found.")
    sys.exit(1)

existing = {f["name"] for f in clients["fields"]}
url = f"{META}/{clients['id']}/fields"

NEW_FIELDS = [
    {
        "name": "Source",
        "type": "singleSelect",
        "description": "Where the lead came from",
        "options": {
            "choices": [
                {"name": "Chatbot", "color": "blueBright"},
                {"name": "Website Form", "color": "yellowBright"},
                {"name": "Phone Call", "color": "greenBright"},
                {"name": "Referral", "color": "purpleBright"},
            ]
        },
    },
    {
        "name": "Converted",
        "type": "checkbox",
        "description": "Mark when the lead becomes a paying client",
        "options": {"icon": "check", "color": "greenBright"},
    },
]

for field in NEW_FIELDS:
    if field["name"] in existing:
        print(f"[skip] {field['name']} already exists")
        continue
    r = requests.post(url, headers=H, json=field)
    if not r.ok:
        print(f"  ERROR adding {field['name']}: {r.status_code} {r.text}")
        continue
    print(f"[OK] Added {field['name']} field")

print("\n[DONE]")
