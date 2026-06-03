from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from db import db
from models import EventConfig, AppearanceConfig

router = APIRouter(prefix="/api/public", tags=["public"])


def _is_expired(valid_until: str | None) -> bool:
    if not valid_until:
        return False
    try:
        dt = datetime.fromisoformat(valid_until.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt < datetime.now(timezone.utc)
    except (ValueError, AttributeError):
        return False


async def _get_active_lots():
    """Returns all active lots (including sold-out and expired) with availability flags."""
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
        lot["progress_pct"] = round(min(100, (sold / lot["quantity"]) * 100), 1) if lot["quantity"] > 0 else 0
        lot["is_sold_out"] = lot["remaining"] <= 0
        lot["is_expired"] = _is_expired(lot.get("valid_until"))
        lot["is_available"] = not lot["is_sold_out"] and not lot["is_expired"]
        out.append(lot)
    return out


@router.get("/config")
async def get_public_config():
    event_doc = await db.app_settings.find_one({"_id": "event"}, {"_id": 0})
    appearance_doc = await db.app_settings.find_one({"_id": "appearance"}, {"_id": 0})
    tickets = await db.ticket_types.find({"is_active": True}, {"_id": 0}).to_list(50)
    lots = await _get_active_lots()
    # First available lot per ticket
    current_lots = {}
    for lot in lots:
        if lot["ticket_type_id"] not in current_lots and lot["is_available"]:
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
