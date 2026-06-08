from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List

from db import db
from models import gen_id, now_iso
from auth import require_roles


def _digits(s: Optional[str]) -> str:
    return "".join(c for c in (s or "") if c.isdigit())


def _is_valid_cpf(cpf: str) -> bool:
    """Validate Brazilian CPF check digits (also accepts already-clean input)."""
    cpf = _digits(cpf)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for i in (9, 10):
        s = sum(int(cpf[j]) * ((i + 1) - j) for j in range(i))
        d = (s * 10) % 11
        if d == 10:
            d = 0
        if d != int(cpf[i]):
            return False
    return True


# ---------- MODELS -----------------------------------------------------------
class CpfDiscountCreate(BaseModel):
    cpf: str
    discount_percent: float = Field(gt=0, le=100)
    description: Optional[str] = ""
    is_active: bool = True


class CpfDiscountUpdate(BaseModel):
    discount_percent: Optional[float] = Field(default=None, gt=0, le=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CpfBulkCreate(BaseModel):
    cpfs: List[str]
    discount_percent: float = Field(gt=0, le=100)
    description: Optional[str] = ""
    is_active: bool = True


# ---------- ADMIN ROUTES -----------------------------------------------------
router = APIRouter(prefix="/api/admin/cpf-discounts", tags=["cpf-discounts"])


@router.get("")
async def list_cpf_discounts(user: dict = Depends(require_roles(["admin", "comercial"]))):
    return await db.cpf_discounts.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)


@router.post("")
async def create_cpf_discount(payload: CpfDiscountCreate, user: dict = Depends(require_roles(["admin"]))):
    cpf_clean = _digits(payload.cpf)
    if not _is_valid_cpf(cpf_clean):
        raise HTTPException(status_code=400, detail=f"CPF inválido: {payload.cpf}")
    existing = await db.cpf_discounts.find_one({"cpf": cpf_clean})
    if existing:
        raise HTTPException(status_code=400, detail="Este CPF já tem desconto cadastrado")
    doc = {
        "cpf_discount_id": gen_id("cpfd"),
        "cpf": cpf_clean,
        "discount_percent": float(payload.discount_percent),
        "description": (payload.description or "").strip(),
        "is_active": payload.is_active,
        "used_count": 0,
        "created_at": now_iso(),
        "created_by": user["user_id"],
    }
    await db.cpf_discounts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/bulk")
async def bulk_create_cpf_discounts(payload: CpfBulkCreate, user: dict = Depends(require_roles(["admin"]))):
    """Bulk import — ignora linhas vazias, comenta CPFs duplicados e inválidos."""
    added: List[dict] = []
    skipped_invalid: List[str] = []
    skipped_duplicate: List[str] = []
    seen_in_batch = set()
    for raw in payload.cpfs:
        cpf_clean = _digits(raw)
        if not cpf_clean:
            continue
        if not _is_valid_cpf(cpf_clean):
            skipped_invalid.append(raw)
            continue
        if cpf_clean in seen_in_batch:
            continue
        seen_in_batch.add(cpf_clean)
        existing = await db.cpf_discounts.find_one({"cpf": cpf_clean})
        if existing:
            skipped_duplicate.append(cpf_clean)
            continue
        doc = {
            "cpf_discount_id": gen_id("cpfd"),
            "cpf": cpf_clean,
            "discount_percent": float(payload.discount_percent),
            "description": (payload.description or "").strip(),
            "is_active": payload.is_active,
            "used_count": 0,
            "created_at": now_iso(),
            "created_by": user["user_id"],
        }
        await db.cpf_discounts.insert_one(doc)
        doc.pop("_id", None)
        added.append(doc)
    return {
        "added": len(added),
        "skipped_invalid": skipped_invalid,
        "skipped_duplicate": skipped_duplicate,
        "items": added,
    }


@router.put("/{cpf_discount_id}")
async def update_cpf_discount(
    cpf_discount_id: str,
    payload: CpfDiscountUpdate,
    user: dict = Depends(require_roles(["admin"])),
):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if updates:
        updates["updated_at"] = now_iso()
        await db.cpf_discounts.update_one({"cpf_discount_id": cpf_discount_id}, {"$set": updates})
    return {"ok": True}


@router.delete("/{cpf_discount_id}")
async def delete_cpf_discount(cpf_discount_id: str, user: dict = Depends(require_roles(["admin"]))):
    await db.cpf_discounts.delete_one({"cpf_discount_id": cpf_discount_id})
    return {"ok": True}


# ---------- PUBLIC LOOKUP ----------------------------------------------------
public_router = APIRouter(prefix="/api/public/cpf-discount", tags=["cpf-discounts-public"])


@public_router.get("")
async def check_cpf_discount(cpf: str = Query(...)):
    """Returns the discount info if the CPF is registered & active. Used by the checkout UI."""
    cpf_clean = _digits(cpf)
    if not cpf_clean:
        return {"eligible": False}
    doc = await db.cpf_discounts.find_one({"cpf": cpf_clean, "is_active": True}, {"_id": 0})
    if not doc:
        return {"eligible": False}
    return {
        "eligible": True,
        "discount_percent": doc["discount_percent"],
        "description": doc.get("description", ""),
    }
