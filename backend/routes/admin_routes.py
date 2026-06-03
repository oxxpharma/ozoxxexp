from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from db import db
from models import EventConfig, AppearanceConfig, TicketTypeCreate, TicketTypeUpdate, UserCreate, UserUpdate, IntegrationsConfig, gen_id, now_iso
from auth import require_roles, hash_password
from services.pagbank import test_connection as pb_test_connection

router = APIRouter(prefix="/api/admin", tags=["admin"])

admin_only = require_roles(["admin"])
admin_or_comercial = require_roles(["admin", "comercial"])
admin_or_financeiro = require_roles(["admin", "financeiro"])


# ---------- APPEARANCE ----------
@router.get("/appearance")
async def get_appearance(user: dict = Depends(admin_only)):
    doc = await db.app_settings.find_one({"_id": "appearance"}, {"_id": 0})
    if not doc:
        doc = AppearanceConfig().model_dump()
    return doc


@router.put("/appearance")
async def update_appearance(payload: AppearanceConfig, user: dict = Depends(admin_only)):
    await db.app_settings.update_one(
        {"_id": "appearance"},
        {"$set": payload.model_dump()},
        upsert=True,
    )
    return {"ok": True}


# ---------- EVENT ----------
@router.get("/event")
async def get_event(user: dict = Depends(admin_only)):
    doc = await db.app_settings.find_one({"_id": "event"}, {"_id": 0})
    if not doc:
        doc = EventConfig().model_dump()
    return doc


@router.put("/event")
async def update_event(payload: EventConfig, user: dict = Depends(admin_only)):
    await db.app_settings.update_one(
        {"_id": "event"},
        {"$set": payload.model_dump()},
        upsert=True,
    )
    return {"ok": True}


# ---------- INTEGRATIONS ----------
@router.get("/integrations")
async def get_integrations(user: dict = Depends(admin_only)):
    doc = await db.app_settings.find_one({"_id": "integrations"}, {"_id": 0})
    if not doc:
        doc = IntegrationsConfig().model_dump()
    return doc


@router.put("/integrations")
async def update_integrations(payload: IntegrationsConfig, user: dict = Depends(admin_only)):
    await db.app_settings.update_one(
        {"_id": "integrations"},
        {"$set": payload.model_dump()},
        upsert=True,
    )
    return {"ok": True}


@router.post("/integrations/test-pagbank")
async def test_pagbank(user: dict = Depends(admin_only)):
    doc = await db.app_settings.find_one({"_id": "integrations"}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=400, detail="Configure as credenciais antes")
    result = await pb_test_connection(doc.get("pagbank_token", ""), doc.get("pagbank_sandbox", True))
    return result


@router.post("/integrations/test-resend")
async def test_resend(user: dict = Depends(admin_only)):
    doc = await db.app_settings.find_one({"_id": "integrations"}, {"_id": 0})
    if not doc or not doc.get("resend_api_key"):
        return {"success": False, "message": "API key do Resend não configurada"}
    import resend, asyncio
    resend.api_key = doc["resend_api_key"]
    try:
        # Try listing domains (lightweight call)
        result = await asyncio.to_thread(resend.Domains.list)
        return {"success": True, "message": "Resend conectado", "details": {"domains": len(result.get("data", [])) if isinstance(result, dict) else 0}}
    except Exception as e:
        return {"success": False, "message": f"Falha: {str(e)}"}


# ---------- USERS ----------
@router.get("/users")
async def list_users(user: dict = Depends(admin_only)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@router.post("/users")
async def create_user(payload: UserCreate, user: dict = Depends(admin_only)):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    doc = {
        "user_id": gen_id("user"),
        "email": email,
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "phone": payload.phone or "",
        "cpf": payload.cpf or "",
        "active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, user: dict = Depends(admin_only)):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items() if k != "password"}
    if payload.password:
        updates["password_hash"] = hash_password(payload.password)
    if not updates:
        return {"ok": True}
    await db.users.update_one({"user_id": user_id}, {"$set": updates})
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(admin_only)):
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Você não pode deletar o próprio usuário")
    await db.users.delete_one({"user_id": user_id})
    return {"ok": True}


# ---------- TICKET TYPES ----------
@router.get("/tickets")
async def list_tickets(user: dict = Depends(admin_or_comercial)):
    items = await db.ticket_types.find({}, {"_id": 0}).to_list(500)
    return items


@router.post("/tickets")
async def create_ticket(payload: TicketTypeCreate, user: dict = Depends(admin_only)):
    doc = {
        "ticket_type_id": gen_id("tkt"),
        **payload.model_dump(),
        "created_at": now_iso(),
    }
    await db.ticket_types.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/tickets/{ticket_type_id}")
async def update_ticket(ticket_type_id: str, payload: TicketTypeUpdate, user: dict = Depends(admin_only)):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if updates:
        await db.ticket_types.update_one({"ticket_type_id": ticket_type_id}, {"$set": updates})
    return {"ok": True}


@router.delete("/tickets/{ticket_type_id}")
async def delete_ticket(ticket_type_id: str, user: dict = Depends(admin_only)):
    await db.ticket_types.delete_one({"ticket_type_id": ticket_type_id})
    return {"ok": True}


# ---------- ORDERS ----------
@router.get("/orders")
async def list_orders(user: dict = Depends(admin_or_financeiro)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders


@router.get("/orders/{order_id}")
async def get_order_admin(order_id: str, user: dict = Depends(admin_or_financeiro)):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    credentials = await db.credentials.find({"order_id": order_id}, {"_id": 0}).to_list(10)
    order["credentials"] = credentials
    return order


# ---------- STATS ----------
@router.get("/stats")
async def stats(user: dict = Depends(admin_only)):
    total_users = await db.users.count_documents({})
    total_orders = await db.orders.count_documents({})
    paid_orders = await db.orders.count_documents({"status": "PAID"})
    pending_orders = await db.orders.count_documents({"status": {"$in": ["WAITING", "IN_ANALYSIS"]}})
    total_credentials = await db.credentials.count_documents({})
    checked_in = await db.credentials.count_documents({"checked_in": True})

    # Revenue
    pipeline = [{"$match": {"status": "PAID"}}, {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}]
    rev = await db.orders.aggregate(pipeline).to_list(1)
    revenue = rev[0]["total"] if rev else 0

    return {
        "total_users": total_users,
        "total_orders": total_orders,
        "paid_orders": paid_orders,
        "pending_orders": pending_orders,
        "total_credentials": total_credentials,
        "checked_in": checked_in,
        "revenue": revenue,
    }
