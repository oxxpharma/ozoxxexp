from fastapi import APIRouter, HTTPException, Response, Request, Depends
from datetime import datetime, timezone, timedelta
import httpx
import uuid

from db import db
from models import RegisterRequest, LoginRequest, gen_id, now_iso
from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
async def register(payload: RegisterRequest, response: Response):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    user_id = gen_id("user")
    doc = {
        "user_id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": "participante",
        "phone": payload.phone or "",
        "cpf": payload.cpf or "",
        "active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(user_id, email, "participante")
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return {"user": doc, "access_token": access}


@router.post("/login")
async def login(payload: LoginRequest, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Usuário desativado")
    access = create_access_token(user["user_id"], email, user.get("role", "participante"))
    refresh = create_refresh_token(user["user_id"])
    set_auth_cookies(response, access, refresh)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": access}


@router.post("/logout")
async def logout(response: Response, request: Request):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/google/session")
async def google_session(request: Request, response: Response):
    """Process Emergent Google Auth session_id from frontend (sent in X-Session-ID header)."""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID header obrigatório")

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Sessão Google inválida")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao validar sessão: {str(e)}")

    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture") or ""
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Dados de sessão incompletos")

    user = await db.users.find_one({"email": email})
    if not user:
        user_id = gen_id("user")
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "participante",
            "phone": "",
            "cpf": "",
            "active": True,
            "auth_provider": "google",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    else:
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="Usuário desativado")

    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "expires_at": expires,
        "created_at": now_iso(),
    })
    response.set_cookie(
        key="session_token", value=session_token, httponly=True, secure=True, samesite="none",
        max_age=7 * 86400, path="/",
    )
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"user": user}
