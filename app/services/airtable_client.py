"""
Singleton Airtable client (pyairtable).
"""
from pyairtable import Api
from app.config import settings

_api: Api | None = None


def get_api() -> Api:
    global _api
    if _api is None:
        if not settings.airtable_api_key or not settings.airtable_base_id:
            raise ValueError(
                "AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env"
            )
        _api = Api(settings.airtable_api_key)
    return _api


def clients_table():
    return get_api().table(settings.airtable_base_id, settings.airtable_clients_table)


def conversations_table():
    return get_api().table(settings.airtable_base_id, settings.airtable_conversations_table)


def messages_table():
    return get_api().table(settings.airtable_base_id, settings.airtable_messages_table)


def calculator_table():
    return get_api().table(settings.airtable_base_id, "Calculator Submissions")
