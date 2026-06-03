from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from db import db
from auth import seed_admin
from models import EventConfig, AppearanceConfig, IntegrationsConfig, gen_id, now_iso

from routes.auth_routes import router as auth_router
from routes.admin_routes import router as admin_router
from routes.public_routes import router as public_router
from routes.orders_routes import router as orders_router, admin_router as orders_admin_router
from routes.scanner_routes import router as scanner_router
from routes.webhook_routes import router as webhook_router
from routes.upload_routes import router as upload_router
from routes.lots_routes import router as lots_router
from routes.coupons_routes import router as coupons_router, public_router as coupons_public_router
from routes.leaders_routes import router as leaders_router, public_router as leaders_public_router
from routes.emails_routes import router as emails_router
from routes.password_reset_routes import router as password_reset_router
from routes.tracking_routes import router as tracking_router, analytics_router
from services.storage import init_storage
from services.email_templates_seed import DEFAULT_TEMPLATES


app = FastAPI(title="Ozoxx Experience API")


@app.get("/api/")
async def root():
    return {"ok": True, "service": "Ozoxx Experience API"}


for r in (auth_router, password_reset_router, admin_router, public_router, orders_router, orders_admin_router,
          scanner_router, webhook_router, upload_router, lots_router, coupons_router, coupons_public_router,
          leaders_router, leaders_public_router, emails_router, tracking_router, analytics_router):
    app.include_router(r)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.orders.create_index("user_id")
    await db.orders.create_index("holder_email")
    await db.orders.create_index("leader_id")
    await db.orders.create_index("lot_id")
    await db.credentials.create_index("credential_code", unique=True)
    await db.credentials.create_index("order_id")
    await db.user_sessions.create_index("session_token", unique=True)
    await db.ticket_types.create_index("ticket_type_id", unique=True)
    await db.lots.create_index("lot_id", unique=True)
    await db.coupons.create_index("code", unique=True)
    await db.coupons.create_index("coupon_id", unique=True)
    await db.leaders.create_index("leader_id", unique=True)
    await db.leaders.create_index("slug", unique=True)
    await db.email_templates.create_index("template_id", unique=True)
    await db.files.create_index("file_id", unique=True)
    await db.password_resets.create_index("token")
    await db.pageviews.create_index("created_at")

    # Init object storage
    init_storage()

    # Seed admin
    await seed_admin()

    # Default settings
    if not await db.app_settings.find_one({"_id": "event"}):
        await db.app_settings.insert_one({"_id": "event", **EventConfig().model_dump()})
    if not await db.app_settings.find_one({"_id": "appearance"}):
        await db.app_settings.insert_one({"_id": "appearance", **AppearanceConfig().model_dump()})
    if not await db.app_settings.find_one({"_id": "integrations"}):
        await db.app_settings.insert_one({"_id": "integrations", **IntegrationsConfig().model_dump()})

    # Default ticket type + default lots
    tkt = await db.ticket_types.find_one({})
    if not tkt:
        tkt_id = gen_id("tkt")
        tkt = {
            "ticket_type_id": tkt_id,
            "name": "Passaporte Ozoxx",
            "description": "Acesso completo aos 2 dias do evento, com áreas premium, networking lounge e shows exclusivos.",
            "is_active": True,
            "created_at": now_iso(),
        }
        await db.ticket_types.insert_one(tkt)
    # Seed default lots if none for this ticket
    if await db.lots.count_documents({"ticket_type_id": tkt["ticket_type_id"]}) == 0:
        await db.lots.insert_many([
            {"lot_id": gen_id("lot"), "ticket_type_id": tkt["ticket_type_id"], "name": "1º Lote", "price": 690.00, "quantity": 100, "order": 1, "is_active": True, "created_at": now_iso()},
            {"lot_id": gen_id("lot"), "ticket_type_id": tkt["ticket_type_id"], "name": "2º Lote", "price": 890.00, "quantity": 200, "order": 2, "is_active": True, "created_at": now_iso()},
            {"lot_id": gen_id("lot"), "ticket_type_id": tkt["ticket_type_id"], "name": "Lote Final", "price": 1290.00, "quantity": 200, "order": 3, "is_active": True, "created_at": now_iso()},
        ])

    # Seed default email templates
    for tpl in DEFAULT_TEMPLATES:
        existing = await db.email_templates.find_one({"template_id": tpl["template_id"]})
        if not existing:
            await db.email_templates.insert_one({**tpl, "created_at": now_iso()})

    logger.info("Ozoxx backend startup complete")


@app.on_event("shutdown")
async def on_shutdown():
    from db import client
    client.close()
