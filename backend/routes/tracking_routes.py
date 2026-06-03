from fastapi import APIRouter, Depends, Request
from datetime import datetime, timezone, timedelta

from db import db
from models import PageViewCreate, now_iso, gen_id
from auth import require_roles

router = APIRouter(prefix="/api/tracking", tags=["tracking"])


@router.post("/pageview")
async def track_pageview(payload: PageViewCreate, request: Request):
    doc = {
        "view_id": gen_id("pv"),
        "path": payload.path,
        "utm_source": payload.utm_source,
        "utm_medium": payload.utm_medium,
        "utm_campaign": payload.utm_campaign,
        "referrer": payload.referrer,
        "leader_slug": payload.leader_slug,
        "session_id": payload.session_id,
        "user_agent": request.headers.get("user-agent", "")[:200],
        "ip": request.client.host if request.client else None,
        "created_at": now_iso(),
    }
    await db.pageviews.insert_one(doc)
    return {"ok": True}


# Reports/Analytics
analytics_router = APIRouter(prefix="/api/admin/analytics", tags=["analytics"])


@analytics_router.get("/funnel")
async def funnel(user: dict = Depends(require_roles(["admin", "comercial"]))):
    """Returns counts for: visits, checkouts started, orders created, orders paid"""
    pv = await db.pageviews.count_documents({})
    checkout_views = await db.pageviews.count_documents({"path": {"$regex": "^/checkout"}})
    orders = await db.orders.count_documents({})
    paid = await db.orders.count_documents({"status": {"$in": ["PAID", "COURTESY"]}})
    return {"visits": pv, "checkout_views": checkout_views, "orders": orders, "paid": paid}


@analytics_router.get("/utm-sources")
async def utm_sources(user: dict = Depends(require_roles(["admin", "comercial"]))):
    pipeline = [
        {"$group": {"_id": {"source": "$utm_source", "medium": "$utm_medium", "campaign": "$utm_campaign"}, "visits": {"$sum": 1}}},
        {"$sort": {"visits": -1}},
        {"$limit": 50},
    ]
    visit_groups = await db.pageviews.aggregate(pipeline).to_list(50)
    # match with orders
    pipeline2 = [
        {"$group": {"_id": {"source": "$utm.utm_source", "medium": "$utm.utm_medium", "campaign": "$utm.utm_campaign"}, "orders": {"$sum": 1}, "paid": {"$sum": {"$cond": [{"$in": ["$status", ["PAID", "COURTESY"]]}, 1, 0]}}, "revenue": {"$sum": {"$cond": [{"$in": ["$status", ["PAID", "COURTESY"]]}, "$total_amount", 0]}}}},
        {"$sort": {"orders": -1}},
    ]
    order_groups = await db.orders.aggregate(pipeline2).to_list(100)
    # merge
    result = {}
    for g in visit_groups:
        key = (g["_id"].get("source") or "Direto", g["_id"].get("medium") or "", g["_id"].get("campaign") or "")
        result[key] = {"source": key[0], "medium": key[1], "campaign": key[2], "visits": g["visits"], "orders": 0, "paid": 0, "revenue": 0}
    for g in order_groups:
        key = (g["_id"].get("source") or "Direto", g["_id"].get("medium") or "", g["_id"].get("campaign") or "")
        if key not in result:
            result[key] = {"source": key[0], "medium": key[1], "campaign": key[2], "visits": 0, "orders": 0, "paid": 0, "revenue": 0}
        result[key]["orders"] = g["orders"]
        result[key]["paid"] = g["paid"]
        result[key]["revenue"] = g.get("revenue", 0)
    return list(result.values())


@analytics_router.get("/daily-visits")
async def daily_visits(days: int = 14, user: dict = Depends(require_roles(["admin", "comercial"]))):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "visits": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    visits = await db.pageviews.aggregate(pipeline).to_list(100)
    return [{"date": v["_id"], "visits": v["visits"]} for v in visits]


@analytics_router.get("/abandoned-carts")
async def abandoned_carts(hours: int = 24, user: dict = Depends(require_roles(["admin", "comercial", "financeiro"]))):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    orders = await db.orders.find({"status": "WAITING", "created_at": {"$lte": cutoff}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@analytics_router.get("/payment-methods")
async def payment_methods(user: dict = Depends(require_roles(["admin", "financeiro"]))):
    pipeline = [
        {"$group": {"_id": "$payment_method", "count": {"$sum": 1}, "paid": {"$sum": {"$cond": [{"$in": ["$status", ["PAID", "COURTESY"]]}, 1, 0]}}}},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(10)
    return [{"method": r["_id"] or "unknown", "count": r["count"], "paid": r["paid"]} for r in rows]


@analytics_router.get("/customer-profile")
async def customer_profile(user: dict = Depends(require_roles(["admin"]))):
    by_gender = await db.users.aggregate([
        {"$match": {"gender": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$gender", "count": {"$sum": 1}}},
    ]).to_list(10)
    by_state = await db.users.aggregate([
        {"$match": {"state": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$state", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]).to_list(10)
    by_city = await db.users.aggregate([
        {"$match": {"city": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]).to_list(10)
    return {"by_gender": by_gender, "by_state": by_state, "by_city": by_city}


@analytics_router.get("/sales-summary")
async def sales_summary(user: dict = Depends(require_roles(["admin", "comercial", "financeiro"]))):
    by_status = await db.orders.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total": {"$sum": "$total_amount"}}},
    ]).to_list(20)
    by_lot = await db.orders.aggregate([
        {"$match": {"status": {"$in": ["PAID", "COURTESY"]}}},
        {"$group": {"_id": "$lot_id", "count": {"$sum": 1}, "tickets": {"$sum": "$quantity"}, "revenue": {"$sum": "$total_amount"}}},
    ]).to_list(50)
    # enrich lot names
    for row in by_lot:
        if row["_id"]:
            lot = await db.lots.find_one({"lot_id": row["_id"]}, {"_id": 0, "name": 1})
            row["lot_name"] = lot["name"] if lot else "(sem lote)"
        else:
            row["lot_name"] = "(sem lote)"
    return {"by_status": by_status, "by_lot": by_lot}
