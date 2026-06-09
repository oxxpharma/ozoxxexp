"""Admin actions over user accounts — used to reactivate old buyer accounts
created before the guest-checkout password feature.

Endpoints:
- GET  /api/admin/users-actions/orphan-buyers           — preview (no writes)
- POST /api/admin/users-actions/reactivate              — create accounts + send set-password e-mail
"""
import re
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Request

from db import db
from models import gen_id, now_iso
from auth import require_roles
from services.email_service import send_html_email, render_template

router = APIRouter(prefix="/api/admin/users-actions", tags=["admin-users-actions"])
admin_only = require_roles(["admin"])


def _email_match(email: str) -> dict:
    return {"$regex": f"^{re.escape(email)}$", "$options": "i"}


async def _aggregate_buyers(only_emails: list[str] | None = None) -> list[dict]:
    match: dict = {
        "status": {"$in": ["PAID", "COURTESY"]},
        "holder_email": {"$nin": [None, ""]},
    }
    if only_emails:
        match["holder_email"] = {"$in": [e.lower() for e in only_emails]}
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"$toLower": "$holder_email"},
            "orders_count": {"$sum": 1},
            "name": {"$first": "$holder_name"},
            "cpf": {"$first": "$holder_cpf"},
            "phone": {"$first": "$holder_phone"},
            "last_order_at": {"$max": "$created_at"},
            "orphan_orders": {"$sum": {"$cond": [{"$eq": ["$user_id", None]}, 1, 0]}},
        }},
        {"$sort": {"last_order_at": -1}},
    ]
    return await db.orders.aggregate(pipeline).to_list(5000)


@router.get("/orphan-buyers")
async def list_orphan_buyers(user: dict = Depends(admin_only)):
    rows = await _aggregate_buyers()
    items = []
    for r in rows:
        email = r["_id"]
        existing = await db.users.find_one(
            {"email": email}, {"_id": 0, "user_id": 1, "password_hash": 1, "created_via": 1}
        )
        has_pw = bool(existing and existing.get("password_hash"))
        if has_pw and r.get("orphan_orders", 0) == 0:
            status = "ok"
        elif has_pw:
            status = "needs_link"  # user has password but some orders are not linked
        elif existing:
            status = "needs_password"
        else:
            status = "needs_account"
        items.append({
            "email": email,
            "name": r.get("name"),
            "cpf": r.get("cpf"),
            "phone": r.get("phone"),
            "orders_count": r.get("orders_count", 0),
            "orphan_orders": r.get("orphan_orders", 0),
            "last_order_at": r.get("last_order_at"),
            "status": status,
            "user_exists": bool(existing),
            "has_password": has_pw,
        })
    return {
        "total": len(items),
        "needs_account": sum(1 for x in items if x["status"] == "needs_account"),
        "needs_password": sum(1 for x in items if x["status"] == "needs_password"),
        "needs_link": sum(1 for x in items if x["status"] == "needs_link"),
        "ok": sum(1 for x in items if x["status"] == "ok"),
        "items": items,
    }


def _build_reactivation_email(name: str, reset_link: str, site_url: str, event_name: str) -> tuple[str, str]:
    subject = f"Acesse seu painel — {event_name}"
    html = (
        "<div style='font-family:Arial,sans-serif;background:#070b1e;padding:40px;color:#fff'>"
        "<table width='560' align='center' style='background:#101638;border-radius:16px;padding:32px'>"
        "<tr><td>"
        f"<h1 style='color:#28b9fc;margin:0 0 12px 0'>Sua conta {event_name} está pronta</h1>"
        f"<p style='color:#a0a8c0'>Olá {name},</p>"
        "<p style='color:#a0a8c0'>Criamos sua conta para você acessar a sua credencial, o QR Code de entrada e os detalhes do seu pedido. "
        "Para começar, defina uma senha agora (o link é válido por 7 dias).</p>"
        "<p style='text-align:center;margin:32px 0'>"
        f"<a href='{reset_link}' style='background:#28b9fc;color:#070b1e;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:bold;display:inline-block'>Definir minha senha</a>"
        "</p>"
        "<p style='color:#a0a8c0;font-size:12px'>Se você não comprou um ingresso conosco, pode ignorar este e-mail com segurança.</p>"
        f"<p style='color:#586079;font-size:11px;margin-top:24px'>{site_url}</p>"
        "</td></tr></table></div>"
    )
    return subject, html


@router.post("/reactivate")
async def reactivate_orphan_buyers(payload: dict, request: Request, user: dict = Depends(admin_only)):
    only_emails = payload.get("only_emails") or None
    send_emails = bool(payload.get("send_emails", True))
    dry_run = bool(payload.get("dry_run", False))

    rows = await _aggregate_buyers(only_emails)

    created = 0
    password_pending = 0  # user existed but had no password — now has a reset token
    skipped_active = 0
    linked_orders = 0
    emails_sent = 0
    emails_failed = 0

    event_doc = await db.app_settings.find_one({"_id": "event"}) or {}
    event_name = event_doc.get("name") or "Ozoxx Experience"
    tpl = await db.email_templates.find_one({"template_id": "tpl_account_reactivation"})
    site = f"{request.url.scheme}://{request.headers.get('host', '')}"

    for r in rows:
        email = r["_id"]
        existing = await db.users.find_one({"email": email})

        # Case A: user already has password — just link orphan orders, no email
        if existing and existing.get("password_hash"):
            if not dry_run and r.get("orphan_orders", 0) > 0:
                res = await db.orders.update_many(
                    {"holder_email": _email_match(email), "user_id": None},
                    {"$set": {"user_id": existing["user_id"]}},
                )
                linked_orders += res.modified_count
            skipped_active += 1
            continue

        # Case B/C: need to create or set password via reset link
        if existing:
            target_user_id = existing["user_id"]
            password_pending += 1
        else:
            target_user_id = gen_id("user")
            if not dry_run:
                await db.users.insert_one({
                    "user_id": target_user_id,
                    "name": r.get("name") or email.split("@")[0],
                    "email": email,
                    "password_hash": None,
                    "cpf": r.get("cpf") or "",
                    "phone": r.get("phone") or "",
                    "role": "participante",
                    "active": True,
                    "created_at": now_iso(),
                    "created_via": "admin_reactivation",
                })
            created += 1

        if not dry_run:
            if r.get("orphan_orders", 0) > 0:
                res = await db.orders.update_many(
                    {"holder_email": _email_match(email), "user_id": None},
                    {"$set": {"user_id": target_user_id}},
                )
                linked_orders += res.modified_count

            # Issue 7-day password reset token
            token = secrets.token_urlsafe(32)
            expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            await db.password_resets.insert_one({
                "reset_id": gen_id("rst"),
                "user_id": target_user_id,
                "token": token,
                "expires_at": expires,
                "used": False,
                "created_at": now_iso(),
                "purpose": "account_reactivation",
            })

            if send_emails:
                reset_link = f"{site}/reset-password?token={token}"
                display_name = r.get("name") or email.split("@")[0]
                if tpl:
                    subject = tpl["subject"]
                    html = render_template(tpl["html"], {
                        "name": display_name,
                        "reset_link": reset_link,
                        "site_url": site,
                        "event_name": event_name,
                    })
                else:
                    subject, html = _build_reactivation_email(display_name, reset_link, site, event_name)
                res = await send_html_email(email, subject, html, template_id="tpl_account_reactivation")
                if res.get("sent"):
                    emails_sent += 1
                else:
                    emails_failed += 1

    return {
        "dry_run": dry_run,
        "candidates": len(rows),
        "created": created,
        "password_pending": password_pending,
        "skipped_already_active": skipped_active,
        "linked_orders": linked_orders,
        "emails_sent": emails_sent,
        "emails_failed": emails_failed,
    }
