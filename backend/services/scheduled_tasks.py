"""Background tasks: order cleanup and payment auto-confirmation."""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from db import db
from models import now_iso
from services.pagbank import (
    get_order_status as pb_get_status,
    get_checkout_status as pb_get_checkout,
    extract_paid_status_from_pagbank,
)

logger = logging.getLogger(__name__)

# How long a WAITING order can stay before being auto-canceled
WAITING_TTL_DAYS = 7
# How often the auto-cancel job runs
CLEANUP_INTERVAL_SECONDS = 3600  # 1 hour
# How often we poll PagBank to auto-confirm WAITING orders
AUTOPOLL_INTERVAL_SECONDS = 60  # 1 minute
# Only auto-poll orders older than this and younger than max_age
AUTOPOLL_MIN_AGE_SECONDS = 30


def _parse_iso(value: str):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, AttributeError):
        return None


async def _create_credentials_for_order(order: dict):
    from routes.orders_routes import _create_credentials_for_order as _gen
    return await _gen(order)


async def cleanup_expired_waiting_orders():
    """Cancels WAITING orders older than WAITING_TTL_DAYS."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=WAITING_TTL_DAYS)
    canceled = 0
    cursor = db.orders.find({"status": "WAITING"}, {"_id": 0})
    async for order in cursor:
        created = _parse_iso(order.get("created_at"))
        if not created or created > cutoff:
            continue
        await db.orders.update_one(
            {"order_id": order["order_id"]},
            {"$set": {
                "status": "CANCELED",
                "updated_at": now_iso(),
                "canceled_reason": f"Auto-cancelado após {WAITING_TTL_DAYS} dias sem pagamento",
            }},
        )
        canceled += 1
    if canceled:
        logger.info(f"[cleanup] Auto-canceled {canceled} WAITING orders > {WAITING_TTL_DAYS} days old")
    return canceled


async def autopoll_waiting_orders():
    """Polls PagBank for WAITING orders to auto-confirm payments not received via webhook."""
    now = datetime.now(timezone.utc)
    # Only orders created between (now - 7 days) and (now - 30s) to skip very fresh
    min_age = now - timedelta(seconds=AUTOPOLL_MIN_AGE_SECONDS)
    max_age = now - timedelta(days=WAITING_TTL_DAYS)
    confirmed = 0
    cursor = db.orders.find(
        {"status": "WAITING", "$or": [
            {"pagbank_order_id": {"$ne": None, "$exists": True}},
            {"pagbank_checkout_id": {"$ne": None, "$exists": True}},
        ]},
        {"_id": 0},
    )
    async for order in cursor:
        created = _parse_iso(order.get("created_at"))
        if not created or created > min_age or created < max_age:
            continue
        new_status = None
        if order.get("pagbank_order_id"):
            r = await pb_get_status(order["pagbank_order_id"])
            if r.get("success"):
                new_status = extract_paid_status_from_pagbank(r["raw"])
        if not new_status and order.get("pagbank_checkout_id"):
            r = await pb_get_checkout(order["pagbank_checkout_id"])
            if r.get("success"):
                new_status = extract_paid_status_from_pagbank(r["raw"])
        if new_status and new_status != order["status"]:
            updates = {"status": new_status, "updated_at": now_iso()}
            if new_status == "PAID":
                updates["paid_at"] = now_iso()
            await db.orders.update_one({"order_id": order["order_id"]}, {"$set": updates})
            if new_status == "PAID" and not order.get("credentials_generated"):
                order["status"] = "PAID"
                await _create_credentials_for_order(order)
                await db.orders.update_one({"order_id": order["order_id"]}, {"$set": {"credentials_generated": True}})
            confirmed += 1
    if confirmed:
        logger.info(f"[autopoll] Confirmed/updated status of {confirmed} orders via PagBank polling")
    return confirmed


async def cleanup_loop():
    """Runs cleanup periodically."""
    while True:
        try:
            await cleanup_expired_waiting_orders()
        except Exception:
            logger.exception("[cleanup] loop error")
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)


async def autopoll_loop():
    """Runs autopoll periodically."""
    while True:
        try:
            await autopoll_waiting_orders()
        except Exception:
            logger.exception("[autopoll] loop error")
        await asyncio.sleep(AUTOPOLL_INTERVAL_SECONDS)
