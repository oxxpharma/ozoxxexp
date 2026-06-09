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
    token = settings.get("pagbank_token") or ""
    v2_token = settings.get("pagbank_v2_token") or ""
    # Strip whitespace/newlines — copia do painel PagBank às vezes vem com \n no final
    return {
        "token": token.strip(),
        "v2_token": v2_token.strip(),
        "email": (settings.get("pagbank_email") or "").strip(),
        "sandbox": settings.get("pagbank_sandbox", True),
        "use_v2": bool(settings.get("pagbank_use_v2", False)),
    }


# ---------- V2 LEGACY (Pagamento Padrão — sem homologação) ------------------
V2_SANDBOX_BASE = "https://ws.sandbox.pagseguro.uol.com.br"
V2_PRODUCTION_BASE = "https://ws.pagseguro.uol.com.br"
V2_PAY_SANDBOX = "https://sandbox.pagseguro.uol.com.br/v2/checkout/payment.html"
V2_PAY_PRODUCTION = "https://pagseguro.uol.com.br/v2/checkout/payment.html"


def v2_base(sandbox: bool) -> str:
    return V2_SANDBOX_BASE if sandbox else V2_PRODUCTION_BASE


def v2_pay_base(sandbox: bool) -> str:
    return V2_PAY_SANDBOX if sandbox else V2_PAY_PRODUCTION


async def create_v2_checkout(
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
) -> dict:
    """Cria um checkout PagSeguro V2 (Pagamento Padrão) — não requer homologação.

    Retorna payment_link para redirecionar o cliente. A página V2 hospedada da
    PagBank mostra cartão, boleto, PIX e saldo PagBank (conforme habilitado na
    conta do lojista). Parcelamento sem juros respeita a configuração da conta.
    """
    import xml.etree.ElementTree as ET

    cfg = await get_pagbank_config()
    if not cfg:
        return {"success": False, "error": "PagBank não configurado"}
    email = cfg.get("email")
    v2_token = cfg.get("v2_token") or cfg.get("token")  # fallback p/ token v4 se v2 não setado
    if not email or not v2_token:
        return {"success": False, "error": "Para usar V2 informe e-mail e token no admin"}

    cpf_clean = _digits(customer_cpf)
    cpf_or_cnpj_valid = _is_valid_cpf(cpf_clean) or _is_valid_cnpj(cpf_clean)
    if not cpf_or_cnpj_valid:
        if cfg.get("sandbox"):
            cpf_clean = SANDBOX_TEST_CPF
        else:
            return {"success": False, "error": "CPF/CNPJ inválido. Verifique e tente novamente."}

    phone_digits = _digits(customer_phone)
    area = phone_digits[:2] if len(phone_digits) >= 10 else "11"
    num = phone_digits[2:] if len(phone_digits) >= 10 else "999999999"

    amount_brl = f"{amount_cents / 100:.2f}"

    form = {
        "currency": "BRL",
        "reference": reference_id,
        "itemId1": "001",
        "itemDescription1": description[:100],
        "itemAmount1": amount_brl,
        "itemQuantity1": "1",
        "senderName": (customer_name or "Cliente")[:50],
        "senderEmail": customer_email,
        "senderCPF": cpf_clean,
        "senderAreaCode": area,
        "senderPhone": num,
    }
    if redirect_url:
        form["redirectURL"] = redirect_url
    if notification_url:
        form["notificationURL"] = notification_url

    url = f"{v2_base(cfg['sandbox'])}/v2/checkout"
    params = {"email": email, "token": v2_token}
    headers = {"Content-Type": "application/x-www-form-urlencoded; charset=ISO-8859-1"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, params=params, data=form, headers=headers)
        if r.status_code != 200:
            logger.error(f"PagBank V2 falhou {r.status_code}: {r.text[:500]}")
            msg = f"PagBank V2 {r.status_code}"
            try:
                root = ET.fromstring(r.text)
                first_err = root.find(".//message")
                if first_err is not None and first_err.text:
                    msg = f"PagBank V2 {r.status_code}: {first_err.text}"
            except Exception:
                pass
            return {"success": False, "error": msg, "raw": r.text[:1000]}

        root = ET.fromstring(r.text)
        code_el = root.find("code")
        if code_el is None or not code_el.text:
            return {"success": False, "error": "PagBank V2 — sem código de checkout", "raw": r.text[:500]}
        checkout_code = code_el.text.strip()
        payment_link = f"{v2_pay_base(cfg['sandbox'])}?code={checkout_code}"
        return {
            "success": True,
            "checkout_id": checkout_code,
            "payment_link": payment_link,
            "raw": r.text,
            "is_v2": True,
        }
    except Exception as e:
        logger.exception("PagBank V2 checkout request failed")
        return {"success": False, "error": str(e)}


async def get_v2_transaction_by_notification(notification_code: str) -> dict:
    """V2 envia POST com notificationCode — buscamos a transação para descobrir status."""
    import xml.etree.ElementTree as ET
    cfg = await get_pagbank_config()
    if not cfg:
        return {"success": False, "error": "PagBank não configurado"}
    email = cfg.get("email")
    v2_token = cfg.get("v2_token") or cfg.get("token")
    url = f"{v2_base(cfg['sandbox'])}/v3/transactions/notifications/{notification_code}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url, params={"email": email, "token": v2_token})
        if r.status_code != 200:
            return {"success": False, "error": f"V2 notif {r.status_code}", "raw": r.text[:500]}
        root = ET.fromstring(r.text)
        # status V2: 1=Aguardando, 2=Em análise, 3=Paga, 4=Disponível, 5=Em disputa,
        #            6=Devolvida, 7=Cancelada
        status_code = (root.findtext("status") or "").strip()
        reference = (root.findtext("reference") or "").strip()
        mapping = {
            "1": "WAITING", "2": "IN_ANALYSIS", "3": "PAID", "4": "PAID",
            "5": "WAITING", "6": "REFUNDED", "7": "CANCELED",
        }
        return {"success": True, "status": mapping.get(status_code, "WAITING"), "reference_id": reference, "raw": r.text}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------- V4 (mantido como estava) ----------------------------------------


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


def _is_valid_cpf(cpf: str) -> bool:
    """Validate Brazilian CPF using check-digit algorithm."""
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
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    weights2 = [6] + weights1
    for wlist, idx in ((weights1, 12), (weights2, 13)):
        s = sum(int(cnpj[i]) * wlist[i] for i in range(idx))
        d = 11 - (s % 11)
        if d >= 10:
            d = 0
        if d != int(cnpj[idx]):
            return False
    return True


# Known-valid CPF used by PagBank sandbox tests
SANDBOX_TEST_CPF = "12345678909"


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

    cpf_clean = _digits(customer_cpf)
    cpf_or_cnpj_valid = _is_valid_cpf(cpf_clean) or _is_valid_cnpj(cpf_clean)
    if not cpf_or_cnpj_valid:
        if cfg.get("sandbox"):
            # In sandbox, fall back to a known-valid test CPF to allow flow testing
            logger.warning(f"Invalid CPF '{cpf_clean}' — using sandbox test CPF for PagBank")
            tax_id = SANDBOX_TEST_CPF
        else:
            return {"success": False, "error": "CPF/CNPJ inválido. Verifique e tente novamente."}
    else:
        tax_id = cpf_clean

    phone_digits = _digits(customer_phone)
    area = phone_digits[:2] if len(phone_digits) >= 10 else "11"
    num = phone_digits[2:] if len(phone_digits) >= 10 else "999999999"

    body = {
        "reference_id": reference_id,
        "customer": {
            "name": customer_name,
            "email": customer_email,
            "tax_id": tax_id,
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
        msg = f"PagBank {r.status_code}"
        try:
            body = r.json()
            errs = body.get("error_messages") or body.get("errors") or []
            if errs:
                first = errs[0]
                desc = first.get("description") or first.get("message") or first.get("code")
                param = first.get("parameter_name") or ""
                if desc:
                    msg = f"PagBank {r.status_code}: {desc}" + (f" ({param})" if param else "")
        except Exception:
            pass
        return {"success": False, "error": msg, "raw": r.text[:1000]}
    except Exception as e:
        logger.exception("PagBank request failed")
        return {"success": False, "error": str(e)}


async def create_checkout(
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
) -> dict:
    """Creates a PagBank hosted checkout (suporta PIX + Cartão de Crédito).
    Retorna payment_link para redirecionar o usuário."""
    cfg = await get_pagbank_config()
    if not cfg or not cfg.get("token"):
        return {"success": False, "error": "PagBank não configurado. Configure no painel admin."}

    cpf_clean = _digits(customer_cpf)
    cpf_or_cnpj_valid = _is_valid_cpf(cpf_clean) or _is_valid_cnpj(cpf_clean)
    if not cpf_or_cnpj_valid:
        if cfg.get("sandbox"):
            tax_id = SANDBOX_TEST_CPF
        else:
            return {"success": False, "error": "CPF/CNPJ inválido. Verifique e tente novamente."}
    else:
        tax_id = cpf_clean

    phone_digits = _digits(customer_phone)
    area = phone_digits[:2] if len(phone_digits) >= 10 else "11"
    num = phone_digits[2:] if len(phone_digits) >= 10 else "999999999"

    body = {
        "reference_id": reference_id,
        "customer": {
            "name": customer_name,
            "email": customer_email,
            "tax_id": tax_id,
            "phones": [{"country": "55", "area": area or "11", "number": num or "999999999", "type": "MOBILE"}],
        },
        "items": [
            {"reference_id": reference_id, "name": description, "quantity": 1, "unit_amount": amount_cents}
        ],
        "payment_methods": [
            {"type": "CREDIT_CARD"},
            {"type": "PIX"},
        ],
        # Removido payment_methods_configs.INSTALLMENTS_LIMIT — a config de parcelamento
        # (ex: 10x sem juros) é puxada automaticamente das configurações da conta PagBank
        # no painel Vendas Online → Configurações → Parcelamento.
        "redirect_url": redirect_url,
        "notification_urls": [notification_url] if notification_url else [],
        "payment_notification_urls": [notification_url] if notification_url else [],
    }

    url = f"{base_url(cfg['sandbox'])}/checkouts"
    headers = {"Authorization": f"Bearer {cfg['token']}", "Content-Type": "application/json", "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, headers=headers, json=body)
        if r.status_code in (200, 201):
            data = r.json()
            payment_link = None
            for lk in data.get("links", []):
                rel = (lk.get("rel") or "").upper()
                if rel in ("PAY", "CHECKOUT", "PAYMENT") or lk.get("media") == "text/html":
                    payment_link = lk.get("href")
                    break
            if not payment_link:
                logger.error(f"PagBank checkout sem payment_link: {data}")
                return {"success": False, "error": "PagBank: link de pagamento não retornado", "raw": data}
            return {
                "success": True,
                "checkout_id": data.get("id"),
                "payment_link": payment_link,
                "raw": data,
            }
        logger.error(f"PagBank create_checkout failed {r.status_code}: {r.text}")
        # Extract human-readable message from PagBank error body if possible
        msg = f"PagBank {r.status_code}"
        try:
            body = r.json()
            errs = body.get("error_messages") or body.get("errors") or []
            if errs:
                first = errs[0]
                desc = first.get("description") or first.get("message") or first.get("code")
                param = first.get("parameter_name") or ""
                if desc:
                    msg = f"PagBank {r.status_code}: {desc}" + (f" ({param})" if param else "")
        except Exception:
            pass
        return {"success": False, "error": msg, "raw": r.text[:1000]}
    except Exception as e:
        logger.exception("PagBank checkout request failed")
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


async def get_checkout_status(checkout_id: str) -> dict:
    """Fetch checkout details to inspect linked orders/charges."""
    cfg = await get_pagbank_config()
    if not cfg or not cfg.get("token"):
        return {"success": False, "error": "PagBank não configurado"}
    url = f"{base_url(cfg['sandbox'])}/checkouts/{checkout_id}"
    headers = {"Authorization": f"Bearer {cfg['token']}", "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers=headers)
        if r.status_code == 200:
            return {"success": True, "raw": r.json()}
        return {"success": False, "error": f"HTTP {r.status_code}", "raw": r.text[:400]}
    except Exception as e:
        return {"success": False, "error": str(e)}


def extract_paid_status_from_pagbank(raw: dict) -> Optional[str]:
    """Look at /orders or /checkouts response and return 'PAID' if any charge is paid."""
    if not raw:
        return None
    # /orders structure: { charges: [{status, ...}] }
    for charge in raw.get("charges") or []:
        st = (charge.get("status") or "").upper()
        if st == "PAID":
            return "PAID"
        if st in ("DECLINED", "CANCELED"):
            return st
    # /checkouts structure: { orders: [{ id, charges: [...] }] }
    for o in raw.get("orders") or []:
        for charge in o.get("charges") or []:
            st = (charge.get("status") or "").upper()
            if st == "PAID":
                return "PAID"
            if st in ("DECLINED", "CANCELED"):
                return st
    return None


async def resolve_checkout_status(checkout_id: str) -> Optional[str]:
    """Fetches a checkout AND its linked orders to determine the actual payment status.
    PagBank /checkouts response only lists linked orders by id; charges live on /orders/{id}.
    Returns 'PAID', 'DECLINED', 'CANCELED' or None when undetermined.
    """
    chk = await get_checkout_status(checkout_id)
    if not chk.get("success"):
        return None
    raw = chk.get("raw") or {}
    # Try inline charges first (sometimes present)
    inline = extract_paid_status_from_pagbank(raw)
    if inline:
        return inline
    # Walk each linked order
    resolved = None
    for o in raw.get("orders") or []:
        oid = o.get("id")
        if not oid:
            continue
        ord_resp = await get_order_status(oid)
        if not ord_resp.get("success"):
            continue
        st = extract_paid_status_from_pagbank(ord_resp.get("raw") or {})
        if st == "PAID":
            return "PAID"
        if st in ("DECLINED", "CANCELED"):
            resolved = st
    return resolved
