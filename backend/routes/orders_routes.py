from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional

from db import db
from models import OrderCreate, gen_id, now_iso
from auth import get_current_user
from services.pagbank import create_order as pb_create_order, get_order_status as pb_get_status
from services.qrcode_gen import generate_qr_png_base64
from services.email_service import send_credential_email

router = APIRouter(prefix="/api/orders", tags=["orders"])


async def _get_event_name() -> str:
    doc = await db.app_settings.find_one({"_id": "event"}, {"_id": 0})
    return (doc or {}).get("name", "Ozoxx Experience")


async def _create_credentials_for_order(order: dict):
    """Generate credentials for an order (1 or 2 depending on companion)."""
    event_name = await _get_event_name()
    credentials_created = []

    # Holder credential
    holder_cred = {
        "credential_id": gen_id("cred"),
        "credential_code": gen_id("ozx").upper().replace("OZX_", "OZX-"),
        "order_id": order["order_id"],
        "user_id": order.get("user_id"),
        "name": order["holder_name"],
        "email": order["holder_email"],
        "ticket_type_id": order["ticket_type_id"],
        "ticket_type_name": order.get("ticket_type_name", ""),
        "is_companion": False,
        "checked_in": False,
        "checked_in_at": None,
        "created_at": now_iso(),
    }
    await db.credentials.insert_one(holder_cred)
    credentials_created.append(holder_cred)

    # Companion credential
    if order.get("has_companion") and order.get("companion"):
        comp = order["companion"]
        comp_cred = {
            "credential_id": gen_id("cred"),
            "credential_code": gen_id("ozx").upper().replace("OZX_", "OZX-"),
            "order_id": order["order_id"],
            "user_id": order.get("user_id"),
            "name": comp.get("name"),
            "email": comp.get("email"),
            "ticket_type_id": order["ticket_type_id"],
            "ticket_type_name": order.get("ticket_type_name", ""),
            "is_companion": True,
            "checked_in": False,
            "checked_in_at": None,
            "created_at": now_iso(),
        }
        await db.credentials.insert_one(comp_cred)
        credentials_created.append(comp_cred)

    # Send emails (best-effort)
    for cred in credentials_created:
        qr_b64 = generate_qr_png_base64(cred["credential_code"])
        await send_credential_email(
            to_email=cred["email"],
            to_name=cred["name"],
            event_name=event_name,
            qr_png_b64=qr_b64,
            credential_code=cred["credential_code"],
            ticket_type_name=cred.get("ticket_type_name") or "Ingresso",
        )

    return credentials_created


@router.post("")
async def create_order_endpoint(payload: OrderCreate, request: Request):
    """Create an order. User may be authenticated or guest (in which case holder_* fields are required)."""
    user = None
    try:
        user = await get_current_user(request)
    except HTTPException:
        user = None

    # Holder info — prefer logged-in user, fallback to payload
    if user:
        holder_name = payload.holder_name or user.get("name")
        holder_email = payload.holder_email or user.get("email")
        holder_cpf = payload.holder_cpf or user.get("cpf", "")
        holder_phone = payload.holder_phone or user.get("phone", "")
        user_id = user["user_id"]
    else:
        if not payload.holder_name or not payload.holder_email:
            raise HTTPException(status_code=400, detail="Informe nome e e-mail do titular ou faça login")
        holder_name = payload.holder_name
        holder_email = payload.holder_email
        holder_cpf = payload.holder_cpf or ""
        holder_phone = payload.holder_phone or ""
        user_id = None

    ticket = await db.ticket_types.find_one({"ticket_type_id": payload.ticket_type_id, "is_active": True}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado ou indisponível")

    qty = 2 if payload.has_companion else 1
    if payload.has_companion and not payload.companion:
        raise HTTPException(status_code=400, detail="Dados do acompanhante são obrigatórios")

    total_amount = float(ticket["price"]) * qty
    amount_cents = int(round(total_amount * 100))

    order_id = gen_id("ord")
    description = f"{ticket['name']} ({qty}x) — Ozoxx Experience"

    order = {
        "order_id": order_id,
        "user_id": user_id,
        "ticket_type_id": ticket["ticket_type_id"],
        "ticket_type_name": ticket["name"],
        "quantity": qty,
        "unit_price": float(ticket["price"]),
        "total_amount": total_amount,
        "currency": "BRL",
        "status": "WAITING",  # WAITING, PAID, IN_ANALYSIS, DECLINED, CANCELED
        "payment_method": payload.payment_method,
        "holder_name": holder_name,
        "holder_email": holder_email,
        "holder_cpf": holder_cpf,
        "holder_phone": holder_phone,
        "has_companion": payload.has_companion,
        "companion": payload.companion.model_dump() if payload.companion else None,
        "pagbank_order_id": None,
        "pagbank_qr_code_url": None,
        "pagbank_qr_code_text": None,
        "credentials_generated": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.orders.insert_one(order)

    # Try to create PagBank order
    notif_url = f"{request.url.scheme}://{request.headers.get('host', '')}/api/webhook/pagbank"
    pb = await pb_create_order(
        reference_id=order_id,
        customer_name=holder_name,
        customer_email=holder_email,
        customer_cpf=holder_cpf,
        customer_phone=holder_phone,
        amount_cents=amount_cents,
        description=description,
        payment_method=payload.payment_method,
        notification_url=notif_url,
    )

    if pb.get("success"):
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "pagbank_order_id": pb.get("order_id"),
                "pagbank_qr_code_url": pb.get("qr_code_url"),
                "pagbank_qr_code_text": pb.get("qr_code_text"),
                "updated_at": now_iso(),
            }}
        )
        order["pagbank_order_id"] = pb.get("order_id")
        order["pagbank_qr_code_url"] = pb.get("qr_code_url")
        order["pagbank_qr_code_text"] = pb.get("qr_code_text")
        order["payment_ready"] = True
    else:
        order["payment_ready"] = False
        order["payment_error"] = pb.get("error", "PagBank indisponível")

    order.pop("_id", None)
    return order


@router.get("/mine")
async def list_my_orders(user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    # attach credentials
    for o in orders:
        creds = await db.credentials.find({"order_id": o["order_id"]}, {"_id": 0}).to_list(10)
        o["credentials"] = creds
    return orders


@router.get("/{order_id}")
async def get_order(order_id: str, request: Request):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    # Authorization: owner OR admin/financeiro OR has a recent session linking the order
    requester = None
    try:
        requester = await get_current_user(request)
    except HTTPException:
        requester = None
    if requester:
        if requester["user_id"] == order.get("user_id") or requester.get("role") in ("admin", "financeiro"):
            pass
        elif requester.get("email") == order.get("holder_email"):
            pass
        else:
            raise HTTPException(status_code=403, detail="Acesso negado")
    else:
        # Allow unauthenticated read but return only minimal fields needed for payment page
        order = {
            "order_id": order["order_id"],
            "status": order["status"],
            "total_amount": order["total_amount"],
            "currency": order.get("currency", "BRL"),
            "ticket_type_name": order.get("ticket_type_name"),
            "quantity": order.get("quantity"),
            "payment_method": order.get("payment_method"),
            "pagbank_qr_code_url": order.get("pagbank_qr_code_url"),
            "pagbank_qr_code_text": order.get("pagbank_qr_code_text"),
            "has_companion": order.get("has_companion"),
            "credentials_generated": order.get("credentials_generated"),
        }
    creds = await db.credentials.find({"order_id": order_id}, {"_id": 0}).to_list(10)
    order["credentials"] = creds
    return order


@router.post("/{order_id}/retry")
async def retry_payment(order_id: str, request: Request):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if order["status"] == "PAID":
        raise HTTPException(status_code=400, detail="Pedido já está pago")

    amount_cents = int(round(order["total_amount"] * 100))
    notif_url = f"{request.url.scheme}://{request.headers.get('host', '')}/api/webhook/pagbank"
    new_ref = f"{order_id}-retry-{int(__import__('time').time())}"
    pb = await pb_create_order(
        reference_id=new_ref,
        customer_name=order["holder_name"],
        customer_email=order["holder_email"],
        customer_cpf=order.get("holder_cpf", ""),
        customer_phone=order.get("holder_phone", ""),
        amount_cents=amount_cents,
        description=f"{order['ticket_type_name']} ({order['quantity']}x)",
        payment_method=order.get("payment_method", "pix"),
        notification_url=notif_url,
    )
    if not pb.get("success"):
        raise HTTPException(status_code=502, detail=f"Falha PagBank: {pb.get('error')}")

    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "pagbank_order_id": pb.get("order_id"),
            "pagbank_qr_code_url": pb.get("qr_code_url"),
            "pagbank_qr_code_text": pb.get("qr_code_text"),
            "status": "WAITING",
            "updated_at": now_iso(),
        }}
    )
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    return order


@router.post("/{order_id}/simulate-pay")
async def simulate_payment(order_id: str):
    """Dev helper to mark order as paid and generate credentials when PagBank webhook is not available.
    Gated by ENABLE_DEV_SIMULATE_PAY env var.
    """
    import os
    if os.environ.get("ENABLE_DEV_SIMULATE_PAY", "true").lower() not in ("1", "true", "yes"):
        raise HTTPException(status_code=403, detail="Simulação desativada")
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if order["status"] == "PAID":
        return {"ok": True, "already_paid": True}
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "PAID", "updated_at": now_iso(), "paid_at": now_iso()}}
    )
    order["status"] = "PAID"
    if not order.get("credentials_generated"):
        await _create_credentials_for_order(order)
        await db.orders.update_one({"order_id": order_id}, {"$set": {"credentials_generated": True}})
    return {"ok": True}


@router.get("/{order_id}/refresh-status")
async def refresh_status(order_id: str):
    """Poll PagBank to update order status."""
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if not order.get("pagbank_order_id"):
        return order
    pb = await pb_get_status(order["pagbank_order_id"])
    if pb.get("success"):
        charges = pb["raw"].get("charges", [])
        if charges:
            pb_status = charges[0].get("status", "WAITING")
            mapped = pb_status
            if pb_status == "PAID":
                if order["status"] != "PAID":
                    await db.orders.update_one({"order_id": order_id}, {"$set": {"status": "PAID", "paid_at": now_iso(), "updated_at": now_iso()}})
                    if not order.get("credentials_generated"):
                        order["status"] = "PAID"
                        await _create_credentials_for_order(order)
                        await db.orders.update_one({"order_id": order_id}, {"$set": {"credentials_generated": True}})
            else:
                await db.orders.update_one({"order_id": order_id}, {"$set": {"status": mapped, "updated_at": now_iso()}})
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    creds = await db.credentials.find({"order_id": order_id}, {"_id": 0}).to_list(10)
    order["credentials"] = creds
    return order
