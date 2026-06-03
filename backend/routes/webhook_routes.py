from fastapi import APIRouter, Request, HTTPException
import logging

from db import db
from models import now_iso
from services.pagbank import get_order_status as pb_get_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhook", tags=["webhook"])


async def _create_credentials_for_order(order: dict):
    # Local import to avoid circular
    from routes.orders_routes import _create_credentials_for_order as _gen
    return await _gen(order)


@router.post("/pagbank")
async def pagbank_webhook(request: Request):
    """PagBank notification — sends order id; we re-fetch to verify status."""
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    logger.info(f"PagBank webhook received: {payload}")

    # PagBank sends "id" of the order
    pb_order_id = payload.get("id") or payload.get("order_id")
    if not pb_order_id:
        return {"ok": True, "ignored": True}

    order = await db.orders.find_one({"pagbank_order_id": pb_order_id}, {"_id": 0})
    if not order:
        return {"ok": True, "not_found": True}

    pb = await pb_get_status(pb_order_id)
    if not pb.get("success"):
        return {"ok": True, "fetch_failed": True}

    charges = pb["raw"].get("charges", [])
    if not charges:
        return {"ok": True, "no_charges": True}

    status = charges[0].get("status", "WAITING")
    if status == "PAID":
        if order["status"] != "PAID":
            await db.orders.update_one({"order_id": order["order_id"]}, {"$set": {"status": "PAID", "paid_at": now_iso(), "updated_at": now_iso()}})
            if not order.get("credentials_generated"):
                order["status"] = "PAID"
                await _create_credentials_for_order(order)
                await db.orders.update_one({"order_id": order["order_id"]}, {"$set": {"credentials_generated": True}})
    else:
        await db.orders.update_one({"order_id": order["order_id"]}, {"$set": {"status": status, "updated_at": now_iso()}})

    return {"ok": True, "status": status}
