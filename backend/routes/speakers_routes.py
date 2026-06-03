from fastapi import APIRouter, Depends, HTTPException
from db import db
from models import SpeakerCreate, SpeakerUpdate, gen_id, now_iso
from auth import require_roles

router = APIRouter(prefix="/api/admin/speakers", tags=["speakers"])
public_router = APIRouter(prefix="/api/public/speakers", tags=["speakers-public"])


@router.get("")
async def list_speakers(user: dict = Depends(require_roles(["admin"]))):
    return await db.speakers.find({}, {"_id": 0}).sort("order", 1).to_list(200)


@router.post("")
async def create_speaker(payload: SpeakerCreate, user: dict = Depends(require_roles(["admin"]))):
    doc = {"speaker_id": gen_id("spk"), **payload.model_dump(), "created_at": now_iso()}
    await db.speakers.insert_one(doc); doc.pop("_id", None); return doc


@router.put("/{speaker_id}")
async def update_speaker(speaker_id: str, payload: SpeakerUpdate, user: dict = Depends(require_roles(["admin"]))):
    upd = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if upd: await db.speakers.update_one({"speaker_id": speaker_id}, {"$set": upd})
    return {"ok": True}


@router.delete("/{speaker_id}")
async def delete_speaker(speaker_id: str, user: dict = Depends(require_roles(["admin"]))):
    await db.speakers.delete_one({"speaker_id": speaker_id}); return {"ok": True}


@public_router.get("")
async def list_public_speakers():
    return await db.speakers.find({"is_active": True}, {"_id": 0}).sort("order", 1).to_list(200)
