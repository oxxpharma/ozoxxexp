"""Asaas payment gateway service (hosted Checkout).

Docs:
- Auth: https://docs.asaas.com/docs/authentication
- Checkout: https://docs.asaas.com/docs/asaas-checkout
- Webhooks: https://docs.asaas.com/docs/sobre-os-webhooks

The API access token is stored in `app_settings.integrations` under keys
`asaas_sandbox_token`, `asaas_production_token` and `asaas_environment`.
"""
import re
import httpx
from typing import Any, Optional

from db import db


SANDBOX_BASE = "https://api-sandbox.asaas.com/v3"
PRODUCTION_BASE = "https://api.asaas.com/v3"


async def get_asaas_config() -> dict:
    settings = await db.app_settings.find_one({"_id": "integrations"}) or {}
    env = (settings.get("asaas_environment") or "sandbox").lower()
    token = settings.get("asaas_sandbox_token") if env == "sandbox" else settings.get("asaas_production_token")
    return {
        "environment": env,
        "token": token or "",
        "webhook_token": settings.get("asaas_webhook_token") or "",
        "base_url": SANDBOX_BASE if env == "sandbox" else PRODUCTION_BASE,
        "enabled": bool(token),
    }


def only_digits(v: str) -> str:
    return re.sub(r"\D", "", v or "")


def _headers(token: str) -> dict[str, str]:
    return {
        "access_token": token,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "OzoxxExperience/1.0",
    }


async def _request(method: str, path: str, *, body: Optional[dict] = None, params: Optional[dict] = None) -> tuple[bool, Any]:
    cfg = await get_asaas_config()
    if not cfg["enabled"]:
        return False, {"error": "Token do Asaas não configurado"}
    async with httpx.AsyncClient(timeout=25) as client:
        try:
            r = await client.request(method, cfg["base_url"] + path, headers=_headers(cfg["token"]), json=body, params=params)
        except httpx.HTTPError as e:
            return False, {"error": f"Falha de conexão com Asaas: {e}"}
    if r.status_code >= 400:
        try:
            data = r.json()
        except Exception:
            data = {"error": r.text}
        return False, {"status": r.status_code, "asaas": data}
    return True, r.json()


async def find_or_create_customer(name: str, cpf: str, email: str, phone: Optional[str] = None) -> tuple[bool, Any]:
    cpf_clean = only_digits(cpf)
    ok, found = await _request("GET", "/customers", params={"cpfCnpj": cpf_clean})
    if ok and isinstance(found, dict) and found.get("data"):
        return True, found["data"][0]
    body = {"name": name, "cpfCnpj": cpf_clean, "email": email}
    if phone:
        body["phone"] = only_digits(phone)
    return await _request("POST", "/customers", body=body)


async def create_checkout(
    *,
    order_id: str,
    customer_name: str,
    customer_email: str,
    customer_cpf: str,
    customer_phone: str,
    amount: float,
    description: str,
    success_url: str,
    cancel_url: str,
    expired_url: str,
    max_installment_count: int = 10,
) -> dict:
    """Create an Asaas Checkout session — buyer picks PIX or credit card on their page.

    We pass `customerData` (not `customer` id) so Asaas can create/reuse the customer
    on their hosted page and prompt the buyer for any missing fields (address, etc.).
    Passing a `customer` id requires the customer to already have phone/address/CEP,
    which we don't collect in our form.
    """
    # Asaas requires items[].name <= 30 chars. Take the ticket portion (before em-dash)
    # and truncate the rest so the buyer sees a clean label.
    short_name = (description.split(" — ")[0] or description).strip()[:30]
    payload: dict[str, Any] = {
        "billingTypes": ["PIX", "CREDIT_CARD"],
        "chargeTypes": ["DETACHED", "INSTALLMENT"],
        "minutesToExpire": 60,
        "externalReference": order_id,
        "callback": {
            "successUrl": success_url,
            "cancelUrl": cancel_url,
            "expiredUrl": expired_url,
        },
        "items": [{
            "name": short_name,
            "description": description[:250],
            "quantity": 1,
            "value": round(float(amount), 2),
        }],
        "installment": {"maxInstallmentCount": max(1, min(max_installment_count, 21))},
        "customerData": {
            "name": customer_name,
            "cpfCnpj": only_digits(customer_cpf),
            "email": customer_email,
        },
    }
    if customer_phone:
        payload["customerData"]["phone"] = only_digits(customer_phone)

    ok, res = await _request("POST", "/checkouts", body=payload)
    if not ok:
        details = res.get("asaas") if isinstance(res, dict) else None
        return {"success": False, "error": (details or res or {}).get("errors", res) if isinstance(details, dict) else res}
    return {
        "success": True,
        "checkout_id": res.get("id"),
        "checkout_url": res.get("link"),
        "status": res.get("status"),
    }


WEBHOOK_EVENTS = [
    "CHECKOUT_PAID", "CHECKOUT_CANCELED", "CHECKOUT_EXPIRED",
    "PAYMENT_CREATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED",
    "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED",
    "PAYMENT_OVERDUE",
]


async def list_webhooks() -> tuple[bool, Any]:
    """List all webhooks configured on the Asaas account (paginated)."""
    all_items: list[dict] = []
    offset, limit = 0, 100
    while True:
        ok, res = await _request("GET", "/webhooks", params={"offset": offset, "limit": limit})
        if not ok:
            return False, res
        data = res.get("data", []) if isinstance(res, dict) else []
        all_items.extend(data)
        if not res.get("hasMore") or len(data) < limit:
            break
        offset += limit
    return True, all_items


async def register_webhook(public_url: str, auth_token: str, email: str = "ops@ozoxx.com") -> dict:
    """Register the webhook endpoint on Asaas.

    Idempotent: first lists existing webhooks; if any has the same URL, returns it
    without creating a duplicate. Otherwise POSTs a new one with the full schema
    required by Asaas v3 (includes `interrupted` and `apiVersion`).
    """
    ok_list, existing = await list_webhooks()
    if ok_list and isinstance(existing, list):
        for wh in existing:
            if (wh.get("url") or "").rstrip("/") == public_url.rstrip("/"):
                return {"success": True, "data": wh, "already_exists": True}

    ok, res = await _request("POST", "/webhooks", body={
        "name": "Ozoxx Experience webhook",
        "url": public_url,
        "email": email,
        "enabled": True,
        "interrupted": False,
        "apiVersion": 3,
        "sendType": "SEQUENTIALLY",
        "authToken": auth_token,
        "events": WEBHOOK_EVENTS,
    })
    return {"success": ok, "data": res, "already_exists": False}


async def get_payment_status(payment_id: str) -> dict:
    ok, res = await _request("GET", f"/payments/{payment_id}")
    if not ok:
        return {"success": False, "error": res}
    return {"success": True, "status": res.get("status"), "raw": res}
