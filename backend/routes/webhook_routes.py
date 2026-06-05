from fastapi import APIRouter, Request
import logging

from db import db
from models import now_iso
from services.pagbank import (
    get_order_status as pb_get_status,
    get_checkout_status as pb_get_checkout,
    extract_paid_status_from_pagbank,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhook", tags=["webhook"])


async def _create_credentials_for_order(order: dict):
    from routes.orders_routes import _create_credentials_for_order as _gen
    return await _gen(order)


async def _apply_status_to_order(order: dict, new_status: str):
    """Apply new status to an order and auto-generate credentials when PAID."""
    if not new_status:
        return
    order_id = order["order_id"]
    if new_status == order.get("status"):
        return
    updates = {"status": new_status, "updated_at": now_iso()}
    if new_status == "PAID":
        updates["paid_at"] = now_iso()
    await db.orders.update_one({"order_id": order_id}, {"$set": updates})
    if new_status == "PAID" and not order.get("credentials_generated"):
        order["status"] = "PAID"
        await _create_credentials_for_order(order)
        await db.orders.update_one({"order_id": order_id}, {"$set": {"credentials_generated": True}})


def _possible_ids(payload: dict) -> list:
    """Collect any IDs that could match an order in our DB."""
    candidates = []
    for key in ("id", "order_id", "checkout_id", "reference_id"):
        v = payload.get(key)
        if v:
            candidates.append(v)
    # Sometimes PagBank wraps it: { data: { id: ... } } or { charges: [{ id: ... }] }
    data = payload.get("data") or {}
    if isinstance(data, dict):
        for key in ("id", "order_id", "checkout_id", "reference_id"):
            v = data.get(key)
            if v:
                candidates.append(v)
    return candidates


@router.post("/pagbank")
async def pagbank_webhook(request: Request):
    """Handles PagBank notifications for both /orders (PIX) and /checkouts (credit card)."""
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    logger.info(f"PagBank webhook received: {payload}")

    candidates = _possible_ids(payload)
    if not candidates:
        return {"ok": True, "ignored": "no ids in payload"}

    # 1) Try to locate the order via known fields
    order = None
    for cid in candidates:
        order = await db.orders.find_one(
            {"$or": [
                {"pagbank_order_id": cid},
                {"pagbank_checkout_id": cid},
                {"order_id": cid},
            ]},
            {"_id": 0},
        )
        if order:
            break

    if not order:
        logger.warning(f"PagBank webhook: no order match for ids={candidates}")
        return {"ok": True, "not_found": True}

    # 2) Re-fetch status from PagBank to verify (don't trust webhook payload blindly)
    new_status = None
    if order.get("pagbank_order_id"):
        r = await pb_get_status(order["pagbank_order_id"])
        if r.get("success"):
            new_status = extract_paid_status_from_pagbank(r["raw"])
    if not new_status and order.get("pagbank_checkout_id"):
        r = await pb_get_checkout(order["pagbank_checkout_id"])
        if r.get("success"):
            new_status = extract_paid_status_from_pagbank(r["raw"])

    if new_status:
        await _apply_status_to_order(order, new_status)
        return {"ok": True, "status": new_status, "order_id": order["order_id"]}
    return {"ok": True, "no_change": True, "order_id": order["order_id"]}
