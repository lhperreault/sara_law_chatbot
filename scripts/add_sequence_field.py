"""
One-shot: add a "Sequence" number field to the Messages table so chat
history can be read back in deterministic order (Vercel lambdas are stateless,
so the in-memory buffer doesn't work and Airtable record order isn't
guaranteed).

Run once:  python scripts/add_sequence_field.py
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
msgs = next((t for t in tables if t["name"] == "Messages"), None)
if not msgs:
    print("ERROR: Messages table not found. Run setup_airtable.py first.")
    sys.exit(1)

existing = {f["name"] for f in msgs["fields"]}
if "Sequence" in existing:
    print("[skip] Sequence field already exists")
    sys.exit(0)

url = f"{META}/{msgs['id']}/fields"
payload = {
    "name": "Sequence",
    "type": "number",
    "options": {"precision": 0},
    "description": "Monotonic ordering key so messages read back in chronological order",
}
r = requests.post(url, headers=H, json=payload)
if not r.ok:
    print(f"ERROR {r.status_code}: {r.text}")
    sys.exit(1)
print("[OK] Added Sequence number field to Messages table")
