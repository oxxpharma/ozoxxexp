import httpx
import logging
from typing import Optional

from db import db

logger = logging.getLogger(__name__)

SANDBOX_BASE = "https://sandbox.api.pagseguro.com"
PRODUCTION_BASE = "https://api.pagseguro.com"


async def get_pagbank_config():
    settings = await db.app_settings.find_one({"_id": "integrations"})
    if not settings:
        return None
    return {
        "token": settings.get("pagbank_token"),
        "email": settings.get("pagbank_email"),
        "sandbox": settings.get("pagbank_sandbox", True),
    }


def base_url(sandbox: bool) -> str:
    return SANDBOX_BASE if sandbox else PRODUCTION_BASE


async def test_connection(token: str, sandbox: bool) -> dict:
    """Quick connectivity check — list public_keys."""
    if not token:
        return {"success": False, "message": "Token PagBank não informado"}
    url = f"{base_url(sandbox)}/public-keys"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(url, headers=headers, json={"type": "card"})
        if r.status_code in (200, 201):
            return {"success": True, "message": "Conexão com PagBank estabelecida com sucesso", "details": {"environment": "sandbox" if sandbox else "production"}}
        return {"success": False, "message": f"PagBank respondeu {r.status_code}", "details": {"body": r.text[:400]}}
    except Exception as e:
        return {"success": False, "message": f"Falha de conexão: {str(e)}"}


def _digits(s: Optional[str]) -> str:
    return "".join(c for c in (s or "") if c.isdigit())


async def create_order(
    *,
    reference_id: str,
    customer_name: str,
    customer_email: str,
    customer_cpf: str,
    customer_phone: str,
    amount_cents: int,
    description: str,
    payment_method: str,  # "pix" or "credit_card"
    notification_url: Optional[str] = None,
) -> dict:
    cfg = await get_pagbank_config()
    if not cfg or not cfg.get("token"):
        return {"success": False, "error": "PagBank não configurado. Configure no painel admin."}

    phone_digits = _digits(customer_phone)
    area = phone_digits[:2] if len(phone_digits) >= 10 else "11"
    num = phone_digits[2:] if len(phone_digits) >= 10 else "999999999"

    body = {
        "reference_id": reference_id,
        "customer": {
            "name": customer_name,
            "email": customer_email,
            "tax_id": _digits(customer_cpf) or "00000000000",
            "phones": [{"country": "55", "area": area or "11", "number": num or "999999999", "type": "MOBILE"}],
        },
        "items": [
            {"reference_id": reference_id, "name": description, "quantity": 1, "unit_amount": amount_cents}
        ],
        "notification_urls": [notification_url] if notification_url else [],
    }

    if payment_method == "pix":
        body["qr_codes"] = [{"amount": {"value": amount_cents}}]
    elif payment_method == "credit_card":
        # For credit card we return the order id; frontend uses checkout link or app needs tokenization.
        # Simplified flow: create an order with a checkout payment link via charges (left as PIX fallback).
        body["qr_codes"] = [{"amount": {"value": amount_cents}}]

    url = f"{base_url(cfg['sandbox'])}/orders"
    headers = {"Authorization": f"Bearer {cfg['token']}", "Content-Type": "application/json", "Accept": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, headers=headers, json=body)
        if r.status_code in (200, 201):
            data = r.json()
            qr = None
            qr_text = None
            if data.get("qr_codes"):
                qr_obj = data["qr_codes"][0]
                qr_text = qr_obj.get("text")
                links = qr_obj.get("links", [])
                for lk in links:
                    if lk.get("media") == "image/png" or "PNG" in (lk.get("rel") or ""):
                        qr = lk.get("href")
                        break
            return {
                "success": True,
                "order_id": data.get("id"),
                "status": (data.get("charges", [{}])[0].get("status") if data.get("charges") else "WAITING"),
                "qr_code_url": qr,
                "qr_code_text": qr_text,
                "raw": data,
            }
        logger.error(f"PagBank create_order failed {r.status_code}: {r.text}")
        return {"success": False, "error": f"PagBank: {r.status_code}", "raw": r.text[:600]}
    except Exception as e:
        logger.exception("PagBank request failed")
        return {"success": False, "error": str(e)}


async def get_order_status(pagbank_order_id: str) -> dict:
    cfg = await get_pagbank_config()
    if not cfg or not cfg.get("token"):
        return {"success": False, "error": "PagBank não configurado"}
    url = f"{base_url(cfg['sandbox'])}/orders/{pagbank_order_id}"
    headers = {"Authorization": f"Bearer {cfg['token']}", "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers=headers)
        if r.status_code == 200:
            return {"success": True, "raw": r.json()}
        return {"success": False, "error": f"HTTP {r.status_code}", "raw": r.text[:400]}
    except Exception as e:
        return {"success": False, "error": str(e)}
