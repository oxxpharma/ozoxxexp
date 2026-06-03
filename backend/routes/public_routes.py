from fastapi import APIRouter, HTTPException

from db import db
from models import EventConfig, AppearanceConfig

router = APIRouter(prefix="/api/public", tags=["public"])


async def _get_active_lots():
    """Returns currently active lots with availability."""
    lots = await db.lots.find({"is_active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    out = []
    for lot in lots:
        agg = await db.orders.aggregate([
            {"$match": {"lot_id": lot["lot_id"], "status": {"$in": ["PAID", "COURTESY", "WAITING"]}}},
            {"$group": {"_id": None, "qty": {"$sum": "$quantity"}}},
        ]).to_list(1)
        sold = agg[0]["qty"] if agg else 0
        lot["sold_qty"] = sold
        lot["remaining"] = max(0, lot["quantity"] - sold)
        out.append(lot)
    return out


@router.get("/config")
async def get_public_config():
    event_doc = await db.app_settings.find_one({"_id": "event"}, {"_id": 0})
    appearance_doc = await db.app_settings.find_one({"_id": "appearance"}, {"_id": 0})
    tickets = await db.ticket_types.find({"is_active": True}, {"_id": 0}).to_list(50)
    lots = await _get_active_lots()
    # Determine current lot per ticket (first lot with availability)
    current_lots = {}
    for lot in lots:
        if lot["ticket_type_id"] not in current_lots and lot["remaining"] > 0:
            current_lots[lot["ticket_type_id"]] = lot
    return {
        "event": event_doc or EventConfig().model_dump(),
        "appearance": appearance_doc or AppearanceConfig().model_dump(),
        "tickets": tickets,
        "lots": lots,
        "current_lots": current_lots,
    }


@router.get("/event")
async def get_event_only():
    event_doc = await db.app_settings.find_one({"_id": "event"}, {"_id": 0})
    return event_doc or EventConfig().model_dump()


@router.get("/tickets")
async def list_active_tickets():
    return await db.ticket_types.find({"is_active": True}, {"_id": 0}).to_list(50)


@router.get("/lots")
async def list_public_lots():
    return await _get_active_lots()
