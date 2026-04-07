"""
One-shot setup script — creates the Clients, Conversations, and Messages
tables (with all required fields) in your Airtable base.

Usage (from project root):
    1. Fill in AIRTABLE_API_KEY and AIRTABLE_BASE_ID in your .env file
    2. pip install -r requirements.txt
    3. python scripts/setup_airtable.py

Safe to re-run: it skips tables/fields that already exist.
"""
import os
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

API_KEY = os.getenv("AIRTABLE_API_KEY")
BASE_ID = os.getenv("AIRTABLE_BASE_ID")

if not API_KEY or not BASE_ID:
    print("ERROR: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env")
    sys.exit(1)

META_URL = f"https://api.airtable.com/v0/meta/bases/{BASE_ID}/tables"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


# ─── Table schemas ─────────────────────────────────────────────────────

CLIENTS_TABLE = {
    "name": "Clients",
    "description": "Website chatbot intakes — Roque Law Firm",
    "fields": [
        {"name": "Name", "type": "singleLineText"},
        {"name": "Email", "type": "email"},
        {"name": "Phone", "type": "phoneNumber"},
        {
            "name": "Intake Type",
            "type": "singleSelect",
            "options": {
                "choices": [
                    {"name": "Criminal Defense", "color": "redBright"},
                    {"name": "Personal Injury", "color": "blueBright"},
                    {"name": "Unknown", "color": "grayBright"},
                ]
            },
        },
        {"name": "Situation", "type": "multilineText"},
        {
            "name": "Urgency",
            "type": "singleSelect",
            "options": {
                "choices": [
                    {"name": "Low", "color": "grayBright"},
                    {"name": "Normal", "color": "yellowBright"},
                    {"name": "High", "color": "orangeBright"},
                    {"name": "Urgent", "color": "redBright"},
                ]
            },
        },
        {
            "name": "Status",
            "type": "singleSelect",
            "options": {
                "choices": [
                    {"name": "New", "color": "blueBright"},
                    {"name": "Contacted", "color": "yellowBright"},
                    {"name": "Qualified", "color": "greenBright"},
                    {"name": "Closed", "color": "grayBright"},
                ]
            },
        },
        {
            "name": "Channel",
            "type": "singleSelect",
            "options": {
                "choices": [
                    {"name": "website", "color": "blueBright"},
                    {"name": "whatsapp", "color": "greenBright"},
                    {"name": "email", "color": "purpleBright"},
                ]
            },
        },
        {"name": "Notes", "type": "multilineText"},
        {"name": "Created", "type": "createdTime", "options": {"result": {"type": "dateTime", "options": {"dateFormat": {"name": "iso"}, "timeFormat": {"name": "24hour"}, "timeZone": "client"}}}},
    ],
}

CONVERSATIONS_TABLE = {
    "name": "Conversations",
    "description": "One row per chat session",
    "fields": [
        {"name": "Conversation ID", "type": "singleLineText"},
        {"name": "Practice Area", "type": "singleLineText"},
        {
            "name": "Channel",
            "type": "singleSelect",
            "options": {
                "choices": [
                    {"name": "website", "color": "blueBright"},
                    {"name": "whatsapp", "color": "greenBright"},
                    {"name": "email", "color": "purpleBright"},
                ]
            },
        },
        {
            "name": "Status",
            "type": "singleSelect",
            "options": {
                "choices": [
                    {"name": "active", "color": "greenBright"},
                    {"name": "closed", "color": "grayBright"},
                ]
            },
        },
        {"name": "Started", "type": "createdTime", "options": {"result": {"type": "dateTime", "options": {"dateFormat": {"name": "iso"}, "timeFormat": {"name": "24hour"}, "timeZone": "client"}}}},
    ],
    # Client link is added after Clients table exists
}

MESSAGES_TABLE = {
    "name": "Messages",
    "description": "Individual chat messages",
    "fields": [
        {"name": "Message ID", "type": "singleLineText"},
        {
            "name": "Role",
            "type": "singleSelect",
            "options": {
                "choices": [
                    {"name": "user", "color": "blueBright"},
                    {"name": "assistant", "color": "greenBright"},
                    {"name": "system", "color": "grayBright"},
                    {"name": "tool", "color": "purpleBright"},
                ]
            },
        },
        {"name": "Content", "type": "multilineText"},
        {"name": "Tool Name", "type": "singleLineText"},
        {"name": "Tool Args", "type": "multilineText"},
        {"name": "Tool Result", "type": "multilineText"},
        {"name": "AI Provider", "type": "singleLineText"},
        {"name": "AI Model", "type": "singleLineText"},
        {"name": "Tokens", "type": "number", "options": {"precision": 0}},
        {
            "name": "Requires Review",
            "type": "checkbox",
            "options": {"icon": "check", "color": "yellowBright"},
        },
        {"name": "Created At", "type": "createdTime", "options": {"result": {"type": "dateTime", "options": {"dateFormat": {"name": "iso"}, "timeFormat": {"name": "24hour"}, "timeZone": "client"}}}},
    ],
    # Conversation link is added after Conversations table exists
}


# ─── Helpers ───────────────────────────────────────────────────────────


def get_existing_tables():
    r = requests.get(META_URL, headers=HEADERS)
    r.raise_for_status()
    return {t["name"]: t for t in r.json().get("tables", [])}


def create_table(schema):
    print(f"  Creating table '{schema['name']}'...")
    r = requests.post(META_URL, headers=HEADERS, json=schema)
    if not r.ok:
        print(f"  ERROR {r.status_code}: {r.text}")
        r.raise_for_status()
    print(f"  ✓ Created '{schema['name']}'")
    return r.json()


def create_field(table_id, field):
    url = f"{META_URL}/{table_id}/fields"
    r = requests.post(url, headers=HEADERS, json=field)
    if not r.ok:
        print(f"    ERROR {r.status_code}: {r.text}")
        r.raise_for_status()
    print(f"    ✓ Field '{field['name']}' added")
    return r.json()


def ensure_table(schema, existing):
    if schema["name"] in existing:
        print(f"  ↷ Table '{schema['name']}' already exists, skipping create")
        return existing[schema["name"]]
    return create_table(schema)


def ensure_field(table, field):
    existing_fields = {f["name"] for f in table.get("fields", [])}
    if field["name"] in existing_fields:
        print(f"    ↷ Field '{field['name']}' exists, skipping")
        return
    create_field(table["id"], field)


# ─── Main ──────────────────────────────────────────────────────────────


def main():
    print(f"Setting up Airtable base {BASE_ID}...\n")

    existing = get_existing_tables()

    # 1. Clients table
    print("[1/3] Clients")
    clients_table = ensure_table(CLIENTS_TABLE, existing)
    clients_id = clients_table["id"]

    # 2. Conversations table (with link to Clients)
    print("\n[2/3] Conversations")
    convo_schema = {
        **CONVERSATIONS_TABLE,
        "fields": CONVERSATIONS_TABLE["fields"]
        + [
            {
                "name": "Client",
                "type": "multipleRecordLinks",
                "options": {"linkedTableId": clients_id},
            }
        ],
    }
    convo_table = ensure_table(convo_schema, existing)
    convo_id = convo_table["id"]
    # If table already existed, make sure the Client link field is there
    if CONVERSATIONS_TABLE["name"] in existing:
        ensure_field(
            convo_table,
            {
                "name": "Client",
                "type": "multipleRecordLinks",
                "options": {"linkedTableId": clients_id},
            },
        )

    # 3. Messages table (with link to Conversations)
    print("\n[3/3] Messages")
    msg_schema = {
        **MESSAGES_TABLE,
        "fields": MESSAGES_TABLE["fields"]
        + [
            {
                "name": "Conversation",
                "type": "multipleRecordLinks",
                "options": {"linkedTableId": convo_id},
            }
        ],
    }
    msg_table = ensure_table(msg_schema, existing)
    if MESSAGES_TABLE["name"] in existing:
        ensure_field(
            msg_table,
            {
                "name": "Conversation",
                "type": "multipleRecordLinks",
                "options": {"linkedTableId": convo_id},
            },
        )

    print("\n✅ Airtable base is ready. Start the server with:")
    print("   uvicorn app.main:app --reload")


if __name__ == "__main__":
    main()
