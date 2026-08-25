"""Asaas gateway routes — webhook receiver + admin register endpoint."""
import os
from fastapi import APIRouter, Depends, Header, HTTPException, Request

from db import db
from models import now_iso
from auth import require_roles
from services.asaas import get_asaas_config, register_webhook as _register


router = APIRouter(prefix="/api/webhook/asaas", tags=["asaas-webhook"])
admin_router = APIRouter(prefix="/api/admin/asaas", tags=["asaas-admin"])


PAID_EVENTS = {"CHECKOUT_PAID", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"}
CANCEL_EVENTS = {"CHECKOUT_CANCELED", "CHECKOUT_EXPIRED", "PAYMENT_OVERDUE"}
REFUND_EVENTS = {"PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"}


@router.post("")
async def receive_webhook(
    request: Request,
    asaas_access_token: str | None = Header(default=None, alias="asaas-access-token"),
):
    cfg = await get_asaas_config()
    expected = cfg.get("webhook_token") or ""
    if not expected or not asaas_access_token or asaas_access_token != expected:
        raise HTTPException(status_code=401, detail="invalid webhook token")

    event = await request.json()
    event_id = event.get("id")
    if not event_id:
        raise HTTPException(status_code=400, detail="missing event id")

    # Idempotency via unique index on event_id
    try:
        await db.asaas_webhook_events.insert_one({
            "event_id": event_id,
            "event": event.get("event"),
            "payload": event,
            "received_at": now_iso(),
        })
    except Exception:
        # DuplicateKey → already processed, ack quickly
        return {"ok": True, "duplicate": True}

    ev_name = event.get("event") or ""
    payment = event.get("payment") or {}
    checkout = event.get("checkout") or {}
    external_ref = payment.get("externalReference") or checkout.get("externalReference")
    provider_id = payment.get("id") or checkout.get("id")

    if not external_ref and not provider_id:
        return {"ok": True, "no_ref": True}

    order_filter = {"$or": []}
    if external_ref:
        order_filter["$or"].append({"order_id": external_ref})
    if provider_id:
        order_filter["$or"].append({"asaas_checkout_id": provider_id})
        order_filter["$or"].append({"asaas_payment_id": provider_id})

    if ev_name in PAID_EVENTS:
        order = await db.orders.find_one(order_filter, {"_id": 0})
        if not order:
            return {"ok": True, "no_order": True}
        if payment.get("id"):
            await db.orders.update_one({"order_id": order["order_id"]}, {"$set": {
                "asaas_payment_id": payment["id"],
                "asaas_last_event": ev_name,
            }})
        from routes.webhook_routes import _apply_status_to_order
        await _apply_status_to_order(order, "PAID")
    elif ev_name in CANCEL_EVENTS:
        await db.orders.update_one(order_filter, {"$set": {
            "status": "CANCELED",
            "asaas_last_event": ev_name,
            "updated_at": now_iso(),
        }})
    elif ev_name in REFUND_EVENTS:
        await db.orders.update_one(order_filter, {"$set": {
            "status": "REFUNDED",
            "asaas_last_event": ev_name,
            "updated_at": now_iso(),
        }})
    return {"ok": True}


@admin_router.post("/register-webhook")
async def register_asaas_webhook(user: dict = Depends(require_roles(["admin"]))):
    cfg = await get_asaas_config()
    if not cfg["enabled"]:
        raise HTTPException(status_code=400, detail="Configure a chave da API do Asaas primeiro")
    if not cfg["webhook_token"]:
        raise HTTPException(status_code=400, detail="Configure o Webhook Auth Token primeiro")
    public_base = os.environ.get("PUBLIC_BASE_URL") or ""
    if not public_base:
        raise HTTPException(status_code=400, detail="PUBLIC_BASE_URL não configurado no backend .env")
    url = f"{public_base.rstrip('/')}/api/webhook/asaas"
    return await _register(url, cfg["webhook_token"])


@admin_router.get("/status")
async def asaas_status(user: dict = Depends(require_roles(["admin"]))):
    cfg = await get_asaas_config()
    return {
        "environment": cfg["environment"],
        "enabled": cfg["enabled"],
        "webhook_configured": bool(cfg["webhook_token"]),
    }
