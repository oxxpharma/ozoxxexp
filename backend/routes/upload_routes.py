from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Response, Header, Query
import uuid
import os
import logging

from db import db
from auth import require_roles, get_current_user
from models import now_iso, gen_id
from services.storage import put_object, get_object

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

APP_NAME = os.environ.get("APP_NAME", "ozoxx")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_BYTES = 5 * 1024 * 1024


@router.post("")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(require_roles(["admin"]))):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não suportado (use PNG/JPG/WEBP/GIF)")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Arquivo maior que 5MB")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    try:
        result = put_object(path, data, file.content_type or "application/octet-stream")
    except Exception as e:
        logger.exception("Storage upload failed")
        raise HTTPException(status_code=502, detail=f"Falha no storage: {str(e)}")

    rec = {
        "file_id": gen_id("file"),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "uploaded_by": user["user_id"],
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(rec)
    rec.pop("_id", None)
    # Build a downloadable URL (relative, frontend will prefix with backend URL)
    rec["url"] = f"/api/uploads/files/{rec['file_id']}"
    return rec


@router.get("")
async def list_files(user: dict = Depends(require_roles(["admin"]))):
    files = await db.files.find({"is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for f in files:
        f["url"] = f"/api/uploads/files/{f['file_id']}"
    return files


@router.delete("/{file_id}")
async def delete_file(file_id: str, user: dict = Depends(require_roles(["admin"]))):
    await db.files.update_one({"file_id": file_id}, {"$set": {"is_deleted": True}})
    return {"ok": True}


@router.get("/files/{file_id}")
async def serve_file(file_id: str):
    rec = await db.files.find_one({"file_id": file_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    try:
        data, content_type = get_object(rec["storage_path"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha no storage: {str(e)}")
    return Response(content=data, media_type=rec.get("content_type") or content_type, headers={
        "Cache-Control": "public, max-age=86400",
    })
