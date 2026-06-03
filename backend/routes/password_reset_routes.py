from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
import os
import secrets

from db import db
from models import ForgotPasswordRequest, ResetPasswordRequest, now_iso, gen_id
from auth import hash_password
from services.email_service import send_html_email, render_template

router = APIRouter(prefix="/api/auth", tags=["password-reset"])


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, request: Request):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    # Always return ok to prevent email enumeration
    if user:
        token = secrets.token_urlsafe(32)
        expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        await db.password_resets.insert_one({
            "reset_id": gen_id("rst"),
            "user_id": user["user_id"],
            "token": token,
            "expires_at": expires,
            "used": False,
            "created_at": now_iso(),
        })
        site = f"{request.url.scheme}://{request.headers.get('host', '')}"
        # Get template
        tpl = await db.email_templates.find_one({"template_id": "tpl_password_reset"})
        if tpl:
            html = render_template(tpl["html"], {"name": user.get("name", ""), "reset_link": f"{site}/reset-password?token={token}"})
            subject = tpl["subject"]
        else:
            html = f"<p>Olá {user.get('name')}, redefina sua senha: <a href='{site}/reset-password?token={token}'>clique aqui</a></p>"
            subject = "Redefina sua senha"
        await send_html_email(user["email"], subject, html, template_id="tpl_password_reset")
    return {"ok": True, "message": "Se este e-mail estiver cadastrado, enviaremos instruções."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    rec = await db.password_resets.find_one({"token": payload.token, "used": False})
    if not rec:
        raise HTTPException(status_code=400, detail="Token inválido")
    try:
        exp = datetime.fromisoformat(rec["expires_at"])
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Token expirado")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Token inválido")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Senha muito curta")

    await db.users.update_one({"user_id": rec["user_id"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_resets.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    return {"ok": True}
