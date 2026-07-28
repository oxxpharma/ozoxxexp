from fastapi import APIRouter, Depends, HTTPException
import re

from db import db
from models import LeaderCreate, LeaderUpdate, gen_id, now_iso
from auth import require_roles, get_current_user

router = APIRouter(prefix="/api/admin/leaders", tags=["leaders"])


def slugify(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9 ]", "", s).strip().lower()
    return re.sub(r"\s+", "-", s)


async def _compute_stats(leader: dict) -> dict:
    """Compute sales/credentials counts for leader + buyers list + courtesy order."""
    sales = await db.orders.count_documents({"leader_id": leader["leader_id"], "status": {"$in": ["PAID", "COURTESY"]}})
    agg = await db.orders.aggregate([
        {"$match": {"leader_id": leader["leader_id"], "status": {"$in": ["PAID", "COURTESY"]}}},
        {"$group": {"_id": None, "tickets": {"$sum": "$quantity"}, "revenue": {"$sum": "$total_amount"}}},
    ]).to_list(1)
    tickets = agg[0]["tickets"] if agg else 0
    revenue = agg[0]["revenue"] if agg else 0
    pending = await db.orders.count_documents({"leader_id": leader["leader_id"], "status": "WAITING"})
    leader["sales_count"] = sales
    leader["tickets_sold"] = tickets
    leader["revenue"] = revenue
    leader["pending_orders"] = pending
    leader["progress_pct"] = min(100, round((tickets / leader["target_sales"]) * 100, 1)) if leader["target_sales"] > 0 else 0
    leader["goal_reached"] = tickets >= leader["target_sales"]
    return leader


async def _leader_buyers(leader_id: str) -> list:
    """List of buyer orders linked to this leader (most recent first)."""
    orders = await db.orders.find(
        {"leader_id": leader_id},
        {"_id": 0, "order_id": 1, "holder_name": 1, "holder_email": 1, "quantity": 1,
         "total_amount": 1, "status": 1, "created_at": 1, "ticket_type_name": 1, "lot_name": 1,
         "payment_method": 1},
    ).sort("created_at", -1).to_list(500)
    return orders


async def _leader_courtesy(leader: dict) -> dict | None:
    """The leader's own COURTESY order + credential (once goal is reached)."""
    if not leader.get("courtesy_credential_issued"):
        return None
    order = await db.orders.find_one(
        {"user_id": leader["user_id"], "status": "COURTESY", "courtesy_reason": "Líder atingiu meta"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not order:
        return None
    cred = await db.credentials.find_one(
        {"order_id": order["order_id"]}, {"_id": 0, "qr_png": 0}
    )
    return {"order": order, "credential": cred}


@router.get("")
async def list_leaders(user: dict = Depends(require_roles(["admin", "comercial"]))):
    leaders = await db.leaders.find({}, {"_id": 0}).to_list(500)
    # attach user info
    for l in leaders:
        u = await db.users.find_one({"user_id": l["user_id"]}, {"_id": 0, "password_hash": 0})
        l["user"] = u
        await _compute_stats(l)
    return leaders


@router.post("")
async def create_leader(payload: LeaderCreate, user: dict = Depends(require_roles(["admin"]))):
    target_user = await db.users.find_one({"user_id": payload.user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    existing = await db.leaders.find_one({"user_id": payload.user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já é líder")
    slug = payload.slug or slugify(target_user.get("name", "lider"))
    # ensure unique slug
    base = slug; n = 1
    while await db.leaders.find_one({"slug": slug}):
        n += 1
        slug = f"{base}-{n}"
    doc = {
        "leader_id": gen_id("ldr"),
        "user_id": payload.user_id,
        "target_sales": payload.target_sales,
        "slug": slug,
        "is_active": True,
        "courtesy_credential_issued": False,
        "created_at": now_iso(),
    }
    await db.leaders.insert_one(doc)
    # also bump user role to "lider" if currently participante
    if target_user.get("role") == "participante":
        await db.users.update_one({"user_id": payload.user_id}, {"$set": {"role": "lider"}})
    doc.pop("_id", None)
    return doc


@router.put("/{leader_id}")
async def update_leader(leader_id: str, payload: LeaderUpdate, user: dict = Depends(require_roles(["admin"]))):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if updates:
        await db.leaders.update_one({"leader_id": leader_id}, {"$set": updates})
    return {"ok": True}


@router.delete("/{leader_id}")
async def delete_leader(leader_id: str, user: dict = Depends(require_roles(["admin"]))):
    leader = await db.leaders.find_one({"leader_id": leader_id})
    if leader:
        await db.leaders.delete_one({"leader_id": leader_id})
        # demote to participante
        await db.users.update_one({"user_id": leader["user_id"], "role": "lider"}, {"$set": {"role": "participante"}})
    return {"ok": True}


# Public route: get leader info by slug (for landing tracking)
public_router = APIRouter(tags=["leaders-public"])


@public_router.get("/api/public/leader/{slug}")
async def public_leader_info(slug: str):
    leader = await db.leaders.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not leader:
        raise HTTPException(status_code=404, detail="Líder não encontrado")
    u = await db.users.find_one({"user_id": leader["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"name": u.get("name") if u else "", "slug": leader["slug"]}


@public_router.get("/api/me/leader")
async def my_leader_stats(user: dict = Depends(get_current_user)):
    leader = await db.leaders.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not leader:
        raise HTTPException(status_code=404, detail="Você não é líder")
    await _compute_stats(leader)
    leader["buyers"] = await _leader_buyers(leader["leader_id"])
    leader["courtesy"] = await _leader_courtesy(leader)
    return leader
