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
from routes.orders_routes import router as orders_router
from routes.scanner_routes import router as scanner_router
from routes.webhook_routes import router as webhook_router


app = FastAPI(title="Ozoxx Experience API")


@app.get("/api/")
async def root():
    return {"ok": True, "service": "Ozoxx Experience API"}


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(public_router)
app.include_router(orders_router)
app.include_router(scanner_router)
app.include_router(webhook_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Note: when allow_credentials=True with cookies and SameSite=None, browsers reject "*".
# Our frontend uses Authorization Bearer header fallback too, so withCredentials cookies work
# only when same origin or when FRONTEND_URL is set explicitly. We accept this trade-off.

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.orders.create_index("user_id")
    await db.credentials.create_index("credential_code", unique=True)
    await db.credentials.create_index("order_id")
    await db.user_sessions.create_index("session_token", unique=True)
    await db.ticket_types.create_index("ticket_type_id", unique=True)

    # Seed admin
    await seed_admin()

    # Default settings
    if not await db.app_settings.find_one({"_id": "event"}):
        await db.app_settings.insert_one({"_id": "event", **EventConfig().model_dump()})
    if not await db.app_settings.find_one({"_id": "appearance"}):
        await db.app_settings.insert_one({"_id": "appearance", **AppearanceConfig().model_dump()})
    if not await db.app_settings.find_one({"_id": "integrations"}):
        await db.app_settings.insert_one({"_id": "integrations", **IntegrationsConfig().model_dump()})

    # Default ticket type
    if await db.ticket_types.count_documents({}) == 0:
        await db.ticket_types.insert_one({
            "ticket_type_id": gen_id("tkt"),
            "name": "Passaporte Ozoxx",
            "description": "Acesso completo aos 2 dias do evento, com áreas premium, networking lounge e shows exclusivos.",
            "price": 890.00,
            "quantity_available": 500,
            "is_active": True,
            "created_at": now_iso(),
        })

    logger.info("Ozoxx backend startup complete")


@app.on_event("shutdown")
async def on_shutdown():
    from db import client
    client.close()
