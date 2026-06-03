from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from db import db
from models import CouponCreate, CouponUpdate, gen_id, now_iso
from auth import require_roles

router = APIRouter(prefix="/api/admin/coupons", tags=["coupons"])


@router.get("")
async def list_coupons(user: dict = Depends(require_roles(["admin", "comercial"]))):
    return await db.coupons.find({}, {"_id": 0}).to_list(500)


@router.post("")
async def create_coupon(payload: CouponCreate, user: dict = Depends(require_roles(["admin"]))):
    code = payload.code.upper().strip()
    existing = await db.coupons.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Código já existe")
    doc = {
        "coupon_id": gen_id("cup"),
        **payload.model_dump(),
        "code": code,
        "used_count": 0,
        "created_at": now_iso(),
    }
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{coupon_id}")
async def update_coupon(coupon_id: str, payload: CouponUpdate, user: dict = Depends(require_roles(["admin"]))):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if updates:
        await db.coupons.update_one({"coupon_id": coupon_id}, {"$set": updates})
    return {"ok": True}


@router.delete("/{coupon_id}")
async def delete_coupon(coupon_id: str, user: dict = Depends(require_roles(["admin"]))):
    await db.coupons.delete_one({"coupon_id": coupon_id})
    return {"ok": True}


# Public validation
public_router = APIRouter(prefix="/api/coupons", tags=["coupons-public"])


@public_router.get("/validate/{code}")
async def validate_coupon(code: str):
    code = code.upper().strip()
    cup = await db.coupons.find_one({"code": code, "is_active": True}, {"_id": 0})
    if not cup:
        raise HTTPException(status_code=404, detail="Cupom inválido")
    if cup.get("valid_until"):
        try:
            until = datetime.fromisoformat(cup["valid_until"].replace("Z", "+00:00"))
            if until < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Cupom expirado")
        except (ValueError, AttributeError):
            pass
    if cup.get("max_uses") is not None and cup.get("used_count", 0) >= cup["max_uses"]:
        raise HTTPException(status_code=400, detail="Cupom esgotado")
    return cup
