from fastapi import APIRouter, Depends, HTTPException, Request, Response
from typing import Optional
import time
from datetime import datetime, timezone

from db import db
from models import OrderCreate, ManualOrderCreate, OrderStatusUpdate, gen_id, now_iso
from auth import get_current_user, require_roles
from services.pagbank import create_order as pb_create_order, get_order_status as pb_get_status, create_checkout as pb_create_checkout, get_checkout_status as pb_get_checkout, extract_paid_status_from_pagbank, resolve_checkout_status as pb_resolve_checkout
from services.qrcode_gen import generate_qr_png_base64
from services.email_service import send_credential_email
from services.pdf_gen import generate_credential_pdf

router = APIRouter(prefix="/api/orders", tags=["orders"])


async def _get_event() -> dict:
    return await db.app_settings.find_one({"_id": "event"}, {"_id": 0}) or {"name": "Ozoxx Experience"}


async def _send_one_credential_email(cred: dict, event: dict):
    qr_b64 = generate_qr_png_base64(cred["credential_code"])
    try:
        pdf_bytes = generate_credential_pdf(cred, event)
    except Exception:
        pdf_bytes = None
    return await send_credential_email(
        to_email=cred["email"],
        to_name=cred["name"],
        event_name=event.get("name", "Ozoxx Experience"),
        qr_png_b64=qr_b64,
        credential_code=cred["credential_code"],
        ticket_type_name=cred.get("ticket_type_name") or "Ingresso",
        pdf_bytes=pdf_bytes,
    )


async def _create_credentials_for_order(order: dict):
    event = await _get_event()
    created = []

    holder_cred = {
        "credential_id": gen_id("cred"),
        "credential_code": "OZX-" + gen_id("c").replace("c_", "").upper(),
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
    created.append(holder_cred)

    if order.get("has_companion") and order.get("companion"):
        comp = order["companion"]
        comp_cred = {
            "credential_id": gen_id("cred"),
            "credential_code": "OZX-" + gen_id("c").replace("c_", "").upper(),
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
        created.append(comp_cred)

    for c in created:
        await _send_one_credential_email(c, event)

    # Check leader goal
    if order.get("leader_id"):
        await _check_leader_goal(order["leader_id"])

    return created


async def _check_leader_goal(leader_id: str):
    leader = await db.leaders.find_one({"leader_id": leader_id})
    if not leader or leader.get("courtesy_credential_issued"):
        return
    agg = await db.orders.aggregate([
        {"$match": {"leader_id": leader_id, "status": {"$in": ["PAID", "COURTESY"]}}},
        {"$group": {"_id": None, "qty": {"$sum": "$quantity"}}},
    ]).to_list(1)
    sold = agg[0]["qty"] if agg else 0
    if sold >= leader.get("target_sales", 999999):
        # Generate courtesy ticket
        user = await db.users.find_one({"user_id": leader["user_id"]}, {"_id": 0, "password_hash": 0})
        if user:
            tkt = await db.ticket_types.find_one({"is_active": True}, {"_id": 0}, sort=[("created_at", 1)])
            if tkt:
                order_id = gen_id("ord")
                order = {
                    "order_id": order_id,
                    "user_id": user["user_id"],
                    "ticket_type_id": tkt["ticket_type_id"],
                    "ticket_type_name": tkt["name"],
                    "lot_id": None,
                    "quantity": 1,
                    "unit_price": 0,
                    "total_amount": 0,
                    "currency": "BRL",
                    "status": "COURTESY",
                    "payment_method": "courtesy",
                    "holder_name": user.get("name"),
                    "holder_email": user.get("email"),
                    "holder_cpf": user.get("cpf", ""),
                    "holder_phone": user.get("phone", ""),
                    "has_companion": False,
                    "companion": None,
                    "leader_id": None,
                    "is_courtesy": True,
                    "courtesy_reason": "Líder atingiu meta",
                    "credentials_generated": True,
                    "created_at": now_iso(),
                    "paid_at": now_iso(),
                }
                await db.orders.insert_one(order)
                holder_cred = {
                    "credential_id": gen_id("cred"),
                    "credential_code": "OZX-" + gen_id("c").replace("c_", "").upper(),
                    "order_id": order_id,
                    "user_id": user["user_id"],
                    "name": user.get("name"),
                    "email": user.get("email"),
                    "ticket_type_id": tkt["ticket_type_id"],
                    "ticket_type_name": tkt["name"],
                    "is_companion": False,
                    "checked_in": False,
                    "checked_in_at": None,
                    "created_at": now_iso(),
                }
                await db.credentials.insert_one(holder_cred)
                event = await _get_event()
                await _send_one_credential_email(holder_cred, event)
                await db.leaders.update_one({"leader_id": leader_id}, {"$set": {"courtesy_credential_issued": True}})


async def _resolve_price(payload: OrderCreate) -> dict:
    """Returns dict with lot, unit_price, ticket_type."""
    ticket = await db.ticket_types.find_one({"ticket_type_id": payload.ticket_type_id, "is_active": True}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")

    lot = None
    if payload.lot_id:
        lot = await db.lots.find_one({"lot_id": payload.lot_id, "is_active": True}, {"_id": 0})
        if not lot:
            raise HTTPException(status_code=404, detail="Lote não encontrado")
        # check expiration
        from routes.public_routes import _is_expired
        if _is_expired(lot.get("valid_until")):
            raise HTTPException(status_code=400, detail="Lote expirado")
        # check availability
        agg = await db.orders.aggregate([
            {"$match": {"lot_id": payload.lot_id, "status": {"$in": ["PAID", "COURTESY", "WAITING"]}}},
            {"$group": {"_id": None, "qty": {"$sum": "$quantity"}}},
        ]).to_list(1)
        sold = agg[0]["qty"] if agg else 0
        qty = 2 if payload.has_companion else 1
        if sold + qty > lot["quantity"]:
            raise HTTPException(status_code=400, detail="Lote esgotado")
        unit_price = lot["price"]
    else:
        # fallback: pick first available lot (active + not expired + not sold out)
        from routes.public_routes import _get_active_lots
        active = await _get_active_lots()
        candidates = [l for l in active if l["ticket_type_id"] == ticket["ticket_type_id"] and l["is_available"]]
        lot = candidates[0] if candidates else None
        if lot:
            unit_price = lot["price"]
        else:
            raise HTTPException(status_code=400, detail="Nenhum lote disponível para este ingresso")

    return {"ticket": ticket, "lot": lot, "unit_price": unit_price}


@router.post("")
async def create_order_endpoint(payload: OrderCreate, request: Request):
    user = None
    try:
        user = await get_current_user(request)
    except HTTPException:
        user = None

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

    resolved = await _resolve_price(payload)
    ticket = resolved["ticket"]
    lot = resolved["lot"]
    unit_price = resolved["unit_price"]

    qty = 2 if payload.has_companion else 1
    if payload.has_companion and not payload.companion:
        raise HTTPException(status_code=400, detail="Dados do acompanhante são obrigatórios")

    subtotal = unit_price * qty
    discount = 0
    coupon = None
    if payload.coupon_code:
        coupon = await db.coupons.find_one({"code": payload.coupon_code.upper(), "is_active": True}, {"_id": 0})
        if coupon:
            if coupon.get("discount_type") == "percent":
                discount = subtotal * (coupon["discount_value"] / 100)
            else:
                discount = min(subtotal, coupon["discount_value"])

    # CPF-based automatic discount — empilha com o cupom (se houver)
    cpf_discount_doc = None
    cpf_discount_value = 0
    cpf_clean = "".join(c for c in (holder_cpf or "") if c.isdigit())
    if cpf_clean:
        cpf_discount_doc = await db.cpf_discounts.find_one(
            {"cpf": cpf_clean, "is_active": True}, {"_id": 0}
        )
        if cpf_discount_doc:
            # Aplica sobre o subtotal pós-cupom (não compounding sobre o desconto)
            base = max(0, subtotal - discount)
            cpf_discount_value = base * (cpf_discount_doc["discount_percent"] / 100)
            discount += cpf_discount_value
    total_amount = max(0, subtotal - discount)
    amount_cents = int(round(total_amount * 100))

    order_id = gen_id("ord")

    # Resolve leader from UTM/leader_slug
    leader_id = None
    if payload.utm and payload.utm.leader_slug:
        ldr = await db.leaders.find_one({"slug": payload.utm.leader_slug, "is_active": True})
        if ldr:
            leader_id = ldr["leader_id"]

    order = {
        "order_id": order_id,
        "user_id": user_id,
        "ticket_type_id": ticket["ticket_type_id"],
        "ticket_type_name": ticket["name"],
        "lot_id": lot["lot_id"] if lot else None,
        "lot_name": lot["name"] if lot else None,
        "quantity": qty,
        "unit_price": float(unit_price),
        "subtotal": subtotal,
        "discount": discount,
        "total_amount": total_amount,
        "currency": "BRL",
        "status": "WAITING",
        "payment_method": payload.payment_method,
        "holder_name": holder_name,
        "holder_email": holder_email.lower(),
        "holder_cpf": holder_cpf,
        "holder_phone": holder_phone,
        "holder_birth_date": payload.holder_birth_date or "",
        "holder_gender": payload.holder_gender or "",
        "holder_city": payload.holder_city or "",
        "holder_state": payload.holder_state or "",
        "has_companion": payload.has_companion,
        "companion": payload.companion.model_dump() if payload.companion else None,
        "coupon_code": coupon["code"] if coupon else None,
        "cpf_discount_id": cpf_discount_doc["cpf_discount_id"] if cpf_discount_doc else None,
        "cpf_discount_percent": cpf_discount_doc["discount_percent"] if cpf_discount_doc else None,
        "cpf_discount_value": cpf_discount_value if cpf_discount_doc else 0,
        "utm": payload.utm.model_dump() if payload.utm else None,
        "leader_id": leader_id,
        "pagbank_order_id": None,
        "pagbank_qr_code_url": None,
        "pagbank_qr_code_text": None,
        "credentials_generated": False,
        "is_courtesy": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.orders.insert_one(order)

    if coupon:
        await db.coupons.update_one({"coupon_id": coupon["coupon_id"]}, {"$inc": {"used_count": 1}})
    if cpf_discount_doc:
        await db.cpf_discounts.update_one(
            {"cpf_discount_id": cpf_discount_doc["cpf_discount_id"]},
            {"$inc": {"used_count": 1}},
        )

    import os as _os
    _public_base = _os.environ.get("PUBLIC_BASE_URL")
    _api_origin = _public_base or f"{request.url.scheme}://{request.headers.get('host', '')}"
    notif_url = f"{_api_origin}/api/webhook/pagbank"
    if total_amount > 0:
        if payload.payment_method == "credit_card":
            # Hosted checkout flow — redirects user to PagBank page for card payment
            origin = _public_base or request.headers.get("origin") or f"{request.url.scheme}://{request.headers.get('host', '')}"
            redirect_url = f"{origin}/payment/{order_id}"
            pb = await pb_create_checkout(
                reference_id=order_id,
                customer_name=holder_name,
                customer_email=holder_email,
                customer_cpf=holder_cpf,
                customer_phone=holder_phone,
                amount_cents=amount_cents,
                description=f"{ticket['name']} ({qty}x) — Ozoxx Experience",
                redirect_url=redirect_url,
                notification_url=notif_url,
            )
            if pb.get("success"):
                await db.orders.update_one({"order_id": order_id}, {"$set": {
                    "pagbank_checkout_id": pb.get("checkout_id"),
                    "pagbank_payment_link": pb.get("payment_link"),
                    "updated_at": now_iso(),
                }, "$unset": {"payment_error": ""}})
                order["pagbank_checkout_id"] = pb.get("checkout_id")
                order["pagbank_payment_link"] = pb.get("payment_link")
                order["payment_ready"] = True
            else:
                error_msg = pb.get("error", "PagBank indisponível")
                await db.orders.update_one({"order_id": order_id}, {"$set": {
                    "payment_error": error_msg, "updated_at": now_iso(),
                }})
                order["payment_ready"] = False
                order["payment_error"] = error_msg
        else:
            pb = await pb_create_order(
                reference_id=order_id,
                customer_name=holder_name,
                customer_email=holder_email,
                customer_cpf=holder_cpf,
                customer_phone=holder_phone,
                amount_cents=amount_cents,
                description=f"{ticket['name']} ({qty}x) — Ozoxx Experience",
                payment_method=payload.payment_method,
                notification_url=notif_url,
            )
            if pb.get("success"):
                await db.orders.update_one({"order_id": order_id}, {"$set": {
                    "pagbank_order_id": pb.get("order_id"),
                    "pagbank_qr_code_url": pb.get("qr_code_url"),
                    "pagbank_qr_code_text": pb.get("qr_code_text"),
                    "updated_at": now_iso(),
                }, "$unset": {"payment_error": ""}})
                order["pagbank_order_id"] = pb.get("order_id")
                order["pagbank_qr_code_url"] = pb.get("qr_code_url")
                order["pagbank_qr_code_text"] = pb.get("qr_code_text")
                order["payment_ready"] = True
            else:
                error_msg = pb.get("error", "PagBank indisponível")
                await db.orders.update_one({"order_id": order_id}, {"$set": {
                    "payment_error": error_msg,
                    "updated_at": now_iso(),
                }})
                order["payment_ready"] = False
                order["payment_error"] = error_msg
    else:
        # Free order (100% coupon discount?) — mark as paid right away
        await db.orders.update_one({"order_id": order_id}, {"$set": {"status": "PAID", "paid_at": now_iso(), "updated_at": now_iso()}})
        order["status"] = "PAID"
        await _create_credentials_for_order(order)
        await db.orders.update_one({"order_id": order_id}, {"$set": {"credentials_generated": True}})

    order.pop("_id", None)
    return order


@router.get("/mine")
async def list_my_orders(user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"$or": [{"user_id": user["user_id"]}, {"holder_email": user["email"]}]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for o in orders:
        creds = await db.credentials.find({"order_id": o["order_id"]}, {"_id": 0}).to_list(10)
        o["credentials"] = creds
    return orders


@router.get("/{order_id}")
async def get_order(order_id: str, request: Request):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    requester = None
    try:
        requester = await get_current_user(request)
    except HTTPException:
        requester = None

    if requester:
        is_owner = requester["user_id"] == order.get("user_id") or requester.get("email") == order.get("holder_email")
        is_staff = requester.get("role") in ("admin", "financeiro", "comercial")
        if not (is_owner or is_staff):
            raise HTTPException(status_code=403, detail="Acesso negado")
        creds = await db.credentials.find({"order_id": order_id}, {"_id": 0}).to_list(10)
        order["credentials"] = creds
        return order
    # Unauth public view
    public = {
        "order_id": order["order_id"], "status": order["status"], "total_amount": order["total_amount"],
        "currency": order.get("currency", "BRL"), "ticket_type_name": order.get("ticket_type_name"),
        "quantity": order.get("quantity"), "payment_method": order.get("payment_method"),
        "pagbank_qr_code_url": order.get("pagbank_qr_code_url"), "pagbank_qr_code_text": order.get("pagbank_qr_code_text"),
        "pagbank_payment_link": order.get("pagbank_payment_link"),
        "has_companion": order.get("has_companion"), "credentials_generated": order.get("credentials_generated"),
        "discount": order.get("discount", 0), "subtotal": order.get("subtotal"), "coupon_code": order.get("coupon_code"),
        "cpf_discount_percent": order.get("cpf_discount_percent"), "cpf_discount_value": order.get("cpf_discount_value", 0),
        "payment_error": order.get("payment_error"),
    }
    return public


@router.post("/{order_id}/retry")
async def retry_payment(order_id: str, request: Request):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if order["status"] == "PAID":
        raise HTTPException(status_code=400, detail="Pedido já pago")

    amount_cents = int(round(order["total_amount"] * 100))
    import os as _os
    _public_base = _os.environ.get("PUBLIC_BASE_URL")
    _api_origin = _public_base or f"{request.url.scheme}://{request.headers.get('host', '')}"
    notif_url = f"{_api_origin}/api/webhook/pagbank"
    new_ref = f"{order_id}-retry-{int(time.time())}"
    payment_method = order.get("payment_method", "pix")

    if payment_method == "credit_card":
        origin = _public_base or request.headers.get("origin") or f"{request.url.scheme}://{request.headers.get('host', '')}"
        redirect_url = f"{origin}/payment/{order_id}"
        pb = await pb_create_checkout(
            reference_id=new_ref,
            customer_name=order["holder_name"], customer_email=order["holder_email"],
            customer_cpf=order.get("holder_cpf", ""), customer_phone=order.get("holder_phone", ""),
            amount_cents=amount_cents,
            description=f"{order['ticket_type_name']} ({order['quantity']}x)",
            redirect_url=redirect_url, notification_url=notif_url,
        )
        if not pb.get("success"):
            raise HTTPException(status_code=502, detail=f"Falha PagBank: {pb.get('error')}")
        await db.orders.update_one({"order_id": order_id}, {"$set": {
            "pagbank_checkout_id": pb.get("checkout_id"),
            "pagbank_payment_link": pb.get("payment_link"),
            "status": "WAITING", "updated_at": now_iso(),
        }, "$unset": {"payment_error": ""}})
        return await db.orders.find_one({"order_id": order_id}, {"_id": 0})

    pb = await pb_create_order(
        reference_id=new_ref,
        customer_name=order["holder_name"], customer_email=order["holder_email"],
        customer_cpf=order.get("holder_cpf", ""), customer_phone=order.get("holder_phone", ""),
        amount_cents=amount_cents,
        description=f"{order['ticket_type_name']} ({order['quantity']}x)",
        payment_method=payment_method, notification_url=notif_url,
    )
    if not pb.get("success"):
        raise HTTPException(status_code=502, detail=f"Falha PagBank: {pb.get('error')}")

    await db.orders.update_one({"order_id": order_id}, {"$set": {
        "pagbank_order_id": pb.get("order_id"),
        "pagbank_qr_code_url": pb.get("qr_code_url"),
        "pagbank_qr_code_text": pb.get("qr_code_text"),
        "status": "WAITING", "updated_at": now_iso(),
    }, "$unset": {"payment_error": ""}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@router.post("/{order_id}/simulate-pay")
async def simulate_payment(order_id: str):
    import os
    if os.environ.get("ENABLE_DEV_SIMULATE_PAY", "false").lower() not in ("1", "true", "yes"):
        raise HTTPException(status_code=403, detail="Simulação desativada")
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if order["status"] == "PAID":
        return {"ok": True, "already_paid": True}
    await db.orders.update_one({"order_id": order_id}, {"$set": {"status": "PAID", "updated_at": now_iso(), "paid_at": now_iso()}})
    order["status"] = "PAID"
    if not order.get("credentials_generated"):
        await _create_credentials_for_order(order)
        await db.orders.update_one({"order_id": order_id}, {"$set": {"credentials_generated": True}})
    return {"ok": True}


@router.get("/{order_id}/refresh-status")
async def refresh_status(order_id: str):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    # PIX flow
    if order.get("pagbank_order_id"):
        pb = await pb_get_status(order["pagbank_order_id"])
        if pb.get("success"):
            new_status = extract_paid_status_from_pagbank(pb["raw"])
            if new_status == "PAID" and order["status"] != "PAID":
                await db.orders.update_one({"order_id": order_id}, {"$set": {"status": "PAID", "paid_at": now_iso(), "updated_at": now_iso()}})
                order["status"] = "PAID"
                if not order.get("credentials_generated"):
                    await _create_credentials_for_order(order)
                    await db.orders.update_one({"order_id": order_id}, {"$set": {"credentials_generated": True}})
            elif new_status and new_status not in (order["status"], "PAID"):
                await db.orders.update_one({"order_id": order_id}, {"$set": {"status": new_status, "updated_at": now_iso()}})

    # Credit card / Checkout flow
    if order["status"] != "PAID" and order.get("pagbank_checkout_id"):
        new_status = await pb_resolve_checkout(order["pagbank_checkout_id"])
        if new_status == "PAID":
            await db.orders.update_one({"order_id": order_id}, {"$set": {"status": "PAID", "paid_at": now_iso(), "updated_at": now_iso()}})
            order["status"] = "PAID"
            if not order.get("credentials_generated"):
                await _create_credentials_for_order(order)
                await db.orders.update_one({"order_id": order_id}, {"$set": {"credentials_generated": True}})
        elif new_status and new_status != order["status"]:
            await db.orders.update_one({"order_id": order_id}, {"$set": {"status": new_status, "updated_at": now_iso()}})

    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    creds = await db.credentials.find({"order_id": order_id}, {"_id": 0}).to_list(10)
    order["credentials"] = creds
    return order


# ----------- ADMIN ACTIONS ON ORDERS ------------

admin_router = APIRouter(prefix="/api/admin/orders-actions", tags=["admin-orders"])


@admin_router.put("/{order_id}/status")
async def admin_update_status(order_id: str, payload: OrderStatusUpdate, user: dict = Depends(require_roles(["admin", "financeiro"]))):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    updates = {"status": payload.status, "updated_at": now_iso()}
    if payload.notes:
        updates["admin_notes"] = payload.notes
    if payload.status == "PAID" and order["status"] != "PAID":
        updates["paid_at"] = now_iso()
    await db.orders.update_one({"order_id": order_id}, {"$set": updates})
    refreshed = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    # Auto-generate credentials if moving to PAID/COURTESY
    if payload.status in ("PAID", "COURTESY") and not refreshed.get("credentials_generated"):
        await _create_credentials_for_order(refreshed)
        await db.orders.update_one({"order_id": order_id}, {"$set": {"credentials_generated": True}})
    return {"ok": True}


@admin_router.post("/{order_id}/resend-email")
async def admin_resend_email(order_id: str, user: dict = Depends(require_roles(["admin"]))):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    creds = await db.credentials.find({"order_id": order_id}, {"_id": 0}).to_list(10)
    if not creds:
        raise HTTPException(status_code=400, detail="Pedido sem credenciais geradas")
    event = await _get_event()
    sent = 0
    for c in creds:
        r = await _send_one_credential_email(c, event)
        if r.get("sent"):
            sent += 1
    return {"sent": sent, "total": len(creds)}


@admin_router.post("/manual-courtesy")
async def admin_create_courtesy(payload: ManualOrderCreate, user: dict = Depends(require_roles(["admin"]))):
    ticket = await db.ticket_types.find_one({"ticket_type_id": payload.ticket_type_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")
    qty = 2 if payload.has_companion else 1
    order_id = gen_id("ord")
    order = {
        "order_id": order_id,
        "user_id": None,
        "ticket_type_id": ticket["ticket_type_id"],
        "ticket_type_name": ticket["name"],
        "lot_id": payload.lot_id,
        "lot_name": None,
        "quantity": qty,
        "unit_price": 0,
        "subtotal": 0,
        "discount": 0,
        "total_amount": 0,
        "currency": "BRL",
        "status": "COURTESY",
        "payment_method": "courtesy",
        "holder_name": payload.holder_name,
        "holder_email": payload.holder_email.lower(),
        "holder_cpf": payload.holder_cpf or "",
        "holder_phone": payload.holder_phone or "",
        "has_companion": payload.has_companion,
        "companion": payload.companion.model_dump() if payload.companion else None,
        "is_courtesy": True,
        "courtesy_reason": payload.notes or "Cortesia",
        "credentials_generated": False,
        "leader_id": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "paid_at": now_iso(),
    }
    await db.orders.insert_one(order)
    await _create_credentials_for_order(order)
    await db.orders.update_one({"order_id": order_id}, {"$set": {"credentials_generated": True}})
    return {"order_id": order_id}


@admin_router.get("/{order_id}/credential-pdf/{credential_code}")
async def admin_credential_pdf(order_id: str, credential_code: str, user: dict = Depends(require_roles(["admin"]))):
    cred = await db.credentials.find_one({"credential_code": credential_code, "order_id": order_id}, {"_id": 0})
    if not cred:
        raise HTTPException(status_code=404, detail="Credencial não encontrada")
    event = await _get_event()
    pdf = generate_credential_pdf(cred, event)
    return Response(content=pdf, media_type="application/pdf", headers={
        "Content-Disposition": f"inline; filename=credencial-{credential_code}.pdf"
    })
