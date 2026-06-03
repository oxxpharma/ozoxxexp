from fastapi import APIRouter, HTTPException

from db import db
from models import EventConfig, AppearanceConfig

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/config")
async def get_public_config():
    event_doc = await db.app_settings.find_one({"_id": "event"}, {"_id": 0})
    appearance_doc = await db.app_settings.find_one({"_id": "appearance"}, {"_id": 0})
    tickets = await db.ticket_types.find({"is_active": True}, {"_id": 0}).to_list(50)
    return {
        "event": event_doc or EventConfig().model_dump(),
        "appearance": appearance_doc or AppearanceConfig().model_dump(),
        "tickets": tickets,
    }


@router.get("/event")
async def get_event_only():
    event_doc = await db.app_settings.find_one({"_id": "event"}, {"_id": 0})
    return event_doc or EventConfig().model_dump()


@router.get("/tickets")
async def list_active_tickets():
    tickets = await db.ticket_types.find({"is_active": True}, {"_id": 0}).to_list(50)
    return tickets
