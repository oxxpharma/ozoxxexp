from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from db import db
from models import EmailTemplate, CustomEmailSend, gen_id, now_iso
from auth import require_roles
from services.email_service import send_html_email, render_template

router = APIRouter(prefix="/api/admin/emails", tags=["emails"])


@router.get("/templates")
async def list_templates(user: dict = Depends(require_roles(["admin"]))):
    return await db.email_templates.find({}, {"_id": 0}).to_list(100)


@router.post("/templates")
async def create_template(payload: EmailTemplate, user: dict = Depends(require_roles(["admin"]))):
    doc = {"template_id": gen_id("tpl"), **payload.model_dump(), "created_at": now_iso()}
    await db.email_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/templates/{template_id}")
async def update_template(template_id: str, payload: EmailTemplate, user: dict = Depends(require_roles(["admin"]))):
    await db.email_templates.update_one({"template_id": template_id}, {"$set": payload.model_dump()})
    return {"ok": True}


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user: dict = Depends(require_roles(["admin"]))):
    await db.email_templates.delete_one({"template_id": template_id})
    return {"ok": True}


@router.get("/logs")
async def list_email_logs(user: dict = Depends(require_roles(["admin"]))):
    return await db.email_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)


@router.post("/send")
async def send_custom_email(payload: CustomEmailSend, user: dict = Depends(require_roles(["admin"]))):
    """Send a custom email to selected audience."""
    # Resolve recipients
    if payload.recipients == "all":
        users = await db.users.find({"active": {"$ne": False}}, {"_id": 0, "password_hash": 0}).to_list(5000)
    elif payload.recipients == "paid_customers":
        paid = await db.orders.distinct("holder_email", {"status": {"$in": ["PAID", "COURTESY"]}})
        users = [{"email": e, "name": e.split("@")[0]} for e in paid if e]
    elif payload.recipients == "leaders":
        leader_user_ids = await db.leaders.distinct("user_id")
        users = await db.users.find({"user_id": {"$in": leader_user_ids}}, {"_id": 0, "password_hash": 0}).to_list(5000)
    elif payload.recipients == "specific":
        users = await db.users.find({"user_id": {"$in": payload.user_ids or []}}, {"_id": 0, "password_hash": 0}).to_list(5000)
    else:
        users = []

    sent = 0
    failed = 0
    for u in users:
        ctx = {
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "site_url": "",
        }
        subject = render_template(payload.subject, ctx)
        html = render_template(payload.html, ctx)
        result = await send_html_email(u["email"], subject, html, template_id=payload.template_id)
        if result.get("sent"):
            sent += 1
        else:
            failed += 1
    return {"sent": sent, "failed": failed, "total": len(users)}
