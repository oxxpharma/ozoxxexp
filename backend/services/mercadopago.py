"""Mercado Pago — Checkout Pro integration.

Uses the modern Preferences API. Customer is redirected to MP's hosted
checkout (init_point), pays with card / PIX / boleto / MP balance, then
returns to our site. We poll/listen via webhook to confirm payment.

Docs: https://www.mercadopago.com.br/developers/pt/reference/preferences/_checkout_preferences/post
"""
import logging
import os
from typing import Optional, List, Dict, Any

import httpx

from db import db

logger = logging.getLogger(__name__)

API_BASE = "https://api.mercadopago.com"


def _digits(s: Optional[str]) -> str:
    return "".join(c for c in (s or "") if c.isdigit())


def _is_valid_cpf(cpf: str) -> bool:
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


def _is_valid_cnpj(cnpj: str) -> bool:
    cnpj = _digits(cnpj)
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6] + w1
    for ws, idx in ((w1, 12), (w2, 13)):
        s = sum(int(cnpj[i]) * ws[i] for i in range(idx))
        d = 11 - (s % 11)
        if d >= 10:
            d = 0
        if d != int(cnpj[idx]):
            return False
    return True


SANDBOX_TEST_CPF = "12345678909"


async def get_mp_config() -> Optional[Dict[str, Any]]:
    s = await db.app_settings.find_one({"_id": "integrations"})
    if not s:
        return None
    return {
        "access_token": (s.get("mp_access_token") or "").strip(),
        "public_key": (s.get("mp_public_key") or "").strip(),
        "sandbox": bool(s.get("mp_sandbox", False)),
    }


async def create_preference(
    *,
    reference_id: str,
    customer_name: str,
    customer_email: str,
    customer_cpf: str,
    customer_phone: str,
    amount_cents: int,
    description: str,
    redirect_url: str,
    notification_url: Optional[str] = None,
    max_installments: int = 12,
) -> dict:
    """Creates a Mercado Pago Checkout Pro preference.

    Returns ``{success, preference_id, init_point, sandbox_init_point}`` or
    ``{success: False, error: ...}``.
    """
    cfg = await get_mp_config()
    if not cfg or not cfg.get("access_token"):
        return {"success": False, "error": "Mercado Pago não configurado no admin"}

    cpf_clean = _digits(customer_cpf)
    if not (_is_valid_cpf(cpf_clean) or _is_valid_cnpj(cpf_clean)):
        if cfg.get("sandbox"):
            cpf_clean = SANDBOX_TEST_CPF
        else:
            return {"success": False, "error": "CPF/CNPJ inválido. Verifique e tente novamente."}

    phone_digits = _digits(customer_phone)
    area = phone_digits[:2] if len(phone_digits) >= 10 else "11"
    num = phone_digits[2:] if len(phone_digits) >= 10 else "999999999"

    # Split name into first/last for MP payer
    parts = (customer_name or "Cliente").strip().split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""

    amount_brl = round(amount_cents / 100, 2)

    body = {
        "items": [
            {
                "id": reference_id,
                "title": description[:255],
                "quantity": 1,
                "currency_id": "BRL",
                "unit_price": amount_brl,
            }
        ],
        "payer": {
            "name": first_name,
            "surname": last_name,
            "email": customer_email,
            "identification": {"type": "CPF", "number": cpf_clean},
            "phone": {"area_code": area, "number": num},
        },
        "external_reference": reference_id,
        "back_urls": {
            "success": redirect_url,
            "pending": redirect_url,
            "failure": redirect_url,
        },
        # Removido auto_return — exige redirect_url HTTPS válida e às vezes bloqueia
        # a criação da preferência durante desenvolvimento local.
        "payment_methods": {
            "installments": max_installments,
            "default_installments": 1,
        },
        "statement_descriptor": "OZOXX",
    }
    if notification_url:
        body["notification_url"] = notification_url

    headers = {
        "Authorization": f"Bearer {cfg['access_token']}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        # X-Idempotency-Key — protege contra cliques duplos no botão
        "X-Idempotency-Key": reference_id,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{API_BASE}/checkout/preferences", json=body, headers=headers)
        if r.status_code in (200, 201):
            data = r.json()
            # In sandbox we use sandbox_init_point; in production init_point
            init = data.get("sandbox_init_point") if cfg.get("sandbox") else data.get("init_point")
            return {
                "success": True,
                "preference_id": data.get("id"),
                "init_point": init or data.get("init_point"),
                "raw": data,
            }
        logger.error(f"MP create_preference failed {r.status_code}: {r.text[:600]}")
        msg = f"Mercado Pago {r.status_code}"
        try:
            body_err = r.json()
            if body_err.get("message"):
                msg = f"Mercado Pago {r.status_code}: {body_err['message']}"
            elif body_err.get("cause"):
                first = body_err["cause"][0] if isinstance(body_err["cause"], list) else body_err["cause"]
                desc = first.get("description") if isinstance(first, dict) else None
                if desc:
                    msg = f"Mercado Pago {r.status_code}: {desc}"
        except Exception:
            pass
        return {"success": False, "error": msg, "raw": r.text[:1000]}
    except Exception as e:
        logger.exception("MP request failed")
        return {"success": False, "error": str(e)}


async def get_payment(payment_id: str) -> dict:
    """Fetch a single payment status by ID."""
    cfg = await get_mp_config()
    if not cfg or not cfg.get("access_token"):
        return {"success": False, "error": "Mercado Pago não configurado"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"{API_BASE}/v1/payments/{payment_id}",
                headers={"Authorization": f"Bearer {cfg['access_token']}", "Accept": "application/json"},
            )
        if r.status_code == 200:
            return {"success": True, "raw": r.json()}
        return {"success": False, "error": f"HTTP {r.status_code}", "raw": r.text[:400]}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def search_payments_by_external_ref(reference_id: str) -> dict:
    """Find payments tied to one of our orders. Used for polling when we know
    only the external_reference (preference_id stored in our DB)."""
    cfg = await get_mp_config()
    if not cfg or not cfg.get("access_token"):
        return {"success": False, "error": "Mercado Pago não configurado"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"{API_BASE}/v1/payments/search",
                params={"external_reference": reference_id},
                headers={"Authorization": f"Bearer {cfg['access_token']}", "Accept": "application/json"},
            )
        if r.status_code == 200:
            return {"success": True, "raw": r.json()}
        return {"success": False, "error": f"HTTP {r.status_code}", "raw": r.text[:400]}
    except Exception as e:
        return {"success": False, "error": str(e)}


def map_mp_status(mp_status: str) -> str:
    """Maps Mercado Pago payment.status to our internal order status."""
    s = (mp_status or "").lower()
    if s == "approved":
        return "PAID"
    if s in ("pending", "in_process", "authorized"):
        return "WAITING"
    if s in ("rejected", "cancelled"):
        return "DECLINED" if s == "rejected" else "CANCELED"
    if s in ("refunded", "charged_back"):
        return "REFUNDED"
    return "WAITING"


def extract_paid_status(raw: dict) -> Optional[str]:
    """Look at a payment response and return our internal status."""
    if not raw:
        return None
    status = raw.get("status")
    if status:
        return map_mp_status(status)
    # Search response: results list
    results = raw.get("results") or []
    best = None
    for p in results:
        st = map_mp_status(p.get("status"))
        if st == "PAID":
            return "PAID"
        if st in ("DECLINED", "CANCELED", "REFUNDED"):
            best = st
    return best


async def resolve_preference_status(preference_id: str, external_reference: str) -> Optional[str]:
    """Find the most-recent payment for a preference. Returns 'PAID' / 'DECLINED' / etc., or None."""
    # MP doesn't have a direct GET /preferences/{id}/payments — we search by external_reference.
    if external_reference:
        r = await search_payments_by_external_ref(external_reference)
        if r.get("success"):
            return extract_paid_status(r["raw"])
    return None


async def test_connection() -> dict:
    """Validates the configured access token by hitting MP's user info endpoint."""
    cfg = await get_mp_config()
    if not cfg or not cfg.get("access_token"):
        return {"success": False, "error": "Access token não configurado"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{API_BASE}/users/me",
                headers={"Authorization": f"Bearer {cfg['access_token']}", "Accept": "application/json"},
            )
        if r.status_code == 200:
            data = r.json()
            return {
                "success": True,
                "id": data.get("id"),
                "email": data.get("email"),
                "nickname": data.get("nickname"),
                "site_id": data.get("site_id"),
            }
        return {"success": False, "error": f"HTTP {r.status_code}", "raw": r.text[:300]}
    except Exception as e:
        return {"success": False, "error": str(e)}
