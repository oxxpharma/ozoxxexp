from fastapi import APIRouter, Depends, HTTPException

from db import db
from models import LotCreate, LotUpdate, gen_id, now_iso
from auth import require_roles

router = APIRouter(prefix="/api/admin/lots", tags=["lots"])


@router.get("")
async def list_lots(user: dict = Depends(require_roles(["admin", "comercial", "financeiro"]))):
    from routes.public_routes import _is_expired
    lots = await db.lots.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    for lot in lots:
        agg = await db.orders.aggregate([
            {"$match": {"lot_id": lot["lot_id"], "status": {"$in": ["PAID", "COURTESY"]}}},
            {"$group": {"_id": None, "qty": {"$sum": "$quantity"}}},
        ]).to_list(1)
        lot["sold_qty"] = agg[0]["qty"] if agg else 0
        lot["remaining"] = max(0, lot["quantity"] - lot["sold_qty"])
        lot["progress_pct"] = round(min(100, (lot["sold_qty"] / lot["quantity"]) * 100), 1) if lot["quantity"] > 0 else 0
        lot["is_sold_out"] = lot["remaining"] <= 0
        lot["is_expired"] = _is_expired(lot.get("valid_until"))
    return lots


@router.post("")
async def create_lot(payload: LotCreate, user: dict = Depends(require_roles(["admin"]))):
    doc = {"lot_id": gen_id("lot"), **payload.model_dump(), "created_at": now_iso()}
    await db.lots.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{lot_id}")
async def update_lot(lot_id: str, payload: LotUpdate, user: dict = Depends(require_roles(["admin"]))):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if updates:
        await db.lots.update_one({"lot_id": lot_id}, {"$set": updates})
    return {"ok": True}


@router.delete("/{lot_id}")
async def delete_lot(lot_id: str, user: dict = Depends(require_roles(["admin"]))):
    await db.lots.delete_one({"lot_id": lot_id})
    return {"ok": True}
