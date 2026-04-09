"""
One-shot: create the Calculator Submissions table in Airtable.

Run once:  python scripts/add_calculator_table.py
Safe to re-run — skips the table if it already exists.
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

# Look up the Clients table id so we can link submissions to it.
r = requests.get(META, headers=H)
r.raise_for_status()
tables = r.json()["tables"]
existing_by_name = {t["name"]: t for t in tables}

clients = existing_by_name.get("Clients")
if not clients:
    print("ERROR: Clients table not found. Run setup_airtable.py first.")
    sys.exit(1)
clients_id = clients["id"]

TABLE_NAME = "Calculator Submissions"

CALCULATOR_SCHEMA = {
    "name": TABLE_NAME,
    "description": "Settlement calculator submissions from the website",
    "fields": [
        {"name": "Submission ID", "type": "singleLineText"},
        {
            "name": "Language",
            "type": "singleSelect",
            "options": {
                "choices": [
                    {"name": "en", "color": "blueBright"},
                    {"name": "es", "color": "yellowBright"},
                ]
            },
        },
        {"name": "Type of Accident", "type": "singleLineText"},
        {"name": "Other Party Fault %", "type": "number", "options": {"precision": 0}},
        {
            "name": "Current Medical Bills",
            "type": "currency",
            "options": {"symbol": "$", "precision": 0},
        },
        {
            "name": "Future Medical",
            "type": "currency",
            "options": {"symbol": "$", "precision": 0},
        },
        {
            "name": "Property Damage",
            "type": "currency",
            "options": {"symbol": "$", "precision": 0},
        },
        {
            "name": "Lost Wages",
            "type": "currency",
            "options": {"symbol": "$", "precision": 0},
        },
        {
            "name": "Future Lost Earnings",
            "type": "currency",
            "options": {"symbol": "$", "precision": 0},
        },
        {
            "name": "Additional Losses",
            "type": "multipleSelects",
            "options": {
                "choices": [
                    {"name": "Out-of-pocket expenses", "color": "blueBright"},
                    {"name": "Rehabilitation / therapy", "color": "greenBright"},
                    {"name": "Home care / nursing", "color": "purpleBright"},
                    {"name": "Assistive devices / mods", "color": "yellowBright"},
                ]
            },
        },
        {
            "name": "Injury Severity",
            "type": "singleSelect",
            "options": {
                "choices": [
                    {"name": "Minor", "color": "grayBright"},
                    {"name": "Moderate", "color": "yellowBright"},
                    {"name": "Severe", "color": "orangeBright"},
                    {"name": "Catastrophic", "color": "redBright"},
                ]
            },
        },
        {
            "name": "Impact Factors",
            "type": "multipleSelects",
            "options": {
                "choices": [
                    {"name": "Chronic pain / ongoing symptoms", "color": "redBright"},
                    {"name": "Emotional distress / anxiety", "color": "orangeBright"},
                    {"name": "Loss of enjoyment of life", "color": "yellowBright"},
                    {"name": "Permanent scarring / disfigurement", "color": "pinkBright"},
                    {"name": "Loss of consortium / relationships", "color": "purpleBright"},
                    {"name": "Unable to return to same work", "color": "blueBright"},
                ]
            },
        },
        {
            "name": "Estimated Low",
            "type": "currency",
            "options": {"symbol": "$", "precision": 0},
        },
        {
            "name": "Estimated High",
            "type": "currency",
            "options": {"symbol": "$", "precision": 0},
        },
        {"name": "Name", "type": "singleLineText"},
        {"name": "Phone", "type": "phoneNumber"},
        {"name": "Email", "type": "email"},
        {
            "name": "Status",
            "type": "singleSelect",
            "options": {
                "choices": [
                    {"name": "Anonymous", "color": "grayBright"},
                    {"name": "Lead", "color": "yellowBright"},
                    {"name": "Contacted", "color": "blueBright"},
                    {"name": "Qualified", "color": "greenBright"},
                    {"name": "Closed", "color": "purpleBright"},
                ]
            },
        },
        {"name": "Page URL", "type": "url"},
        {
            "name": "Client",
            "type": "multipleRecordLinks",
            "options": {"linkedTableId": clients_id},
        },
    ],
}

if TABLE_NAME in existing_by_name:
    print(f"[skip] Table '{TABLE_NAME}' already exists")
    sys.exit(0)

r = requests.post(META, headers=H, json=CALCULATOR_SCHEMA)
if not r.ok:
    print(f"ERROR {r.status_code}: {r.text}")
    sys.exit(1)

print(f"[OK] Created table '{TABLE_NAME}'")
