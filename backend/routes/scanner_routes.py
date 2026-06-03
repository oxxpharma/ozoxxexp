from fastapi import APIRouter, Depends, HTTPException, Request
import logging

from db import db
from models import now_iso
from auth import require_roles, get_current_user
from services.qrcode_gen import generate_qr_png_base64

logger = logging.getLogger(__name__)

router = APIRouter(tags=["scanner"])

scan_roles = require_roles(["admin", "credenciadora"])


@router.post("/api/scanner/validate")
async def validate_credential(payload: dict, user: dict = Depends(scan_roles)):
    code = (payload.get("code") or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Código vazio")
    cred = await db.credentials.find_one({"credential_code": code}, {"_id": 0})
    if not cred:
        return {"valid": False, "reason": "not_found", "message": "Credencial não encontrada"}

    order = await db.orders.find_one({"order_id": cred["order_id"]}, {"_id": 0})
    if not order or order.get("status") != "PAID":
        return {"valid": False, "reason": "unpaid", "message": "Pedido não está pago"}

    if cred.get("checked_in"):
        return {
            "valid": False,
            "reason": "already_checked_in",
            "message": f"Já validada em {cred.get('checked_in_at')}",
            "credential": cred,
        }

    await db.credentials.update_one(
        {"credential_code": code},
        {"$set": {"checked_in": True, "checked_in_at": now_iso(), "checked_in_by": user["user_id"]}}
    )
    cred["checked_in"] = True
    cred["checked_in_at"] = now_iso()
    return {"valid": True, "message": "Check-in realizado com sucesso!", "credential": cred}


@router.get("/api/scanner/checkins")
async def list_recent_checkins(user: dict = Depends(scan_roles)):
    creds = await db.credentials.find({"checked_in": True}, {"_id": 0}).sort("checked_in_at", -1).limit(50).to_list(50)
    return creds


# ---------- Participant credential view ----------
@router.get("/api/me/credentials")
async def my_credentials(user: dict = Depends(get_current_user)):
    """Returns all credentials linked to current user (by user_id OR by holder_email)."""
    creds = await db.credentials.find(
        {"$or": [{"user_id": user["user_id"]}, {"email": user["email"]}]},
        {"_id": 0}
    ).to_list(50)
    # attach order info
    for c in creds:
        order = await db.orders.find_one({"order_id": c["order_id"]}, {"_id": 0})
        c["order_status"] = (order or {}).get("status")
        c["qr_png"] = generate_qr_png_base64(c["credential_code"])
    return creds


@router.get("/api/credentials/public/{code}")
async def credential_public_view(code: str):
    """Limited public lookup by code — returns whether it's valid/active. (Used as a fallback)."""
    cred = await db.credentials.find_one({"credential_code": code.upper()}, {"_id": 0, "email": 0})
    if not cred:
        raise HTTPException(status_code=404, detail="Credencial não encontrada")
    order = await db.orders.find_one({"order_id": cred["order_id"]}, {"_id": 0})
    cred["order_status"] = (order or {}).get("status")
    cred["qr_png"] = generate_qr_png_base64(cred["credential_code"])
    return cred
