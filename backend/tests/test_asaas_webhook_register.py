"""Unit tests for asaas.register_webhook — validates full payload schema
(includes required `interrupted` and `apiVersion`) and idempotent behavior.

These tests bypass HTTP by monkeypatching `services.asaas._request`.
"""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services import asaas as asaas_mod  # noqa: E402


class _FakeRequest:
    """Records calls to `_request` and returns queued responses."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    async def __call__(self, method, path, *, body=None, params=None):
        self.calls.append({"method": method, "path": path, "body": body, "params": params})
        return self.responses.pop(0)


@pytest.fixture(autouse=True)
def _fake_config(monkeypatch):
    async def fake_cfg():
        return {
            "environment": "sandbox",
            "token": "TKN",
            "webhook_token": "WHK_SECRET_TOKEN_WITH_ENOUGH_LENGTH_1234",
            "base_url": asaas_mod.SANDBOX_BASE,
            "enabled": True,
        }
    monkeypatch.setattr(asaas_mod, "get_asaas_config", fake_cfg)


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def test_register_webhook_sends_required_fields(monkeypatch):
    # 1) list_webhooks -> empty; 2) POST -> created
    fake = _FakeRequest([
        (True, {"data": [], "hasMore": False}),
        (True, {"id": "wh_1", "url": "https://api.example.com/api/webhook/asaas"}),
    ])
    monkeypatch.setattr(asaas_mod, "_request", fake)

    result = _run(asaas_mod.register_webhook(
        "https://api.example.com/api/webhook/asaas",
        "WHK_SECRET_TOKEN_WITH_ENOUGH_LENGTH_1234",
    ))

    assert result["success"] is True
    assert result["already_exists"] is False
    # First call = GET /webhooks (idempotency check)
    assert fake.calls[0]["method"] == "GET"
    assert fake.calls[0]["path"] == "/webhooks"
    # Second call = POST /webhooks with full schema
    post = fake.calls[1]
    assert post["method"] == "POST"
    assert post["path"] == "/webhooks"
    body = post["body"]
    # Fields that were missing in the old code and caused the Asaas error:
    assert body["interrupted"] is False
    assert body["apiVersion"] == 3
    # Other required fields
    assert body["name"]
    assert body["url"] == "https://api.example.com/api/webhook/asaas"
    assert body["email"]
    assert body["enabled"] is True
    assert body["sendType"] == "SEQUENTIALLY"
    assert body["authToken"] == "WHK_SECRET_TOKEN_WITH_ENOUGH_LENGTH_1234"
    assert isinstance(body["events"], list) and len(body["events"]) > 0


def test_register_webhook_is_idempotent(monkeypatch):
    # list_webhooks returns one already-registered webhook with same URL
    fake = _FakeRequest([
        (True, {
            "data": [{"id": "wh_existing", "url": "https://api.example.com/api/webhook/asaas"}],
            "hasMore": False,
        }),
    ])
    monkeypatch.setattr(asaas_mod, "_request", fake)

    result = _run(asaas_mod.register_webhook(
        "https://api.example.com/api/webhook/asaas",
        "WHK_SECRET_TOKEN_WITH_ENOUGH_LENGTH_1234",
    ))

    assert result["success"] is True
    assert result["already_exists"] is True
    assert result["data"]["id"] == "wh_existing"
    # Only GET was performed — no POST
    assert len(fake.calls) == 1
    assert fake.calls[0]["method"] == "GET"


def test_register_webhook_handles_trailing_slash(monkeypatch):
    fake = _FakeRequest([
        (True, {
            "data": [{"id": "wh_slash", "url": "https://api.example.com/api/webhook/asaas/"}],
            "hasMore": False,
        }),
    ])
    monkeypatch.setattr(asaas_mod, "_request", fake)

    result = _run(asaas_mod.register_webhook(
        "https://api.example.com/api/webhook/asaas",
        "WHK_SECRET_TOKEN_WITH_ENOUGH_LENGTH_1234",
    ))

    # Same URL modulo trailing slash — should be treated as existing
    assert result["already_exists"] is True
    assert len(fake.calls) == 1


def test_register_webhook_creates_when_url_differs(monkeypatch):
    fake = _FakeRequest([
        (True, {
            "data": [{"id": "wh_other", "url": "https://old.example.com/api/webhook/asaas"}],
            "hasMore": False,
        }),
        (True, {"id": "wh_new"}),
    ])
    monkeypatch.setattr(asaas_mod, "_request", fake)

    result = _run(asaas_mod.register_webhook(
        "https://api.example.com/api/webhook/asaas",
        "WHK_SECRET_TOKEN_WITH_ENOUGH_LENGTH_1234",
    ))

    assert result["success"] is True
    assert result["already_exists"] is False
    assert len(fake.calls) == 2
    assert fake.calls[1]["method"] == "POST"


def test_create_checkout_payload_schema(monkeypatch):
    """Default (any) — both PIX and CREDIT_CARD available, chargeTypes include both."""
    fake = _FakeRequest([
        (True, {"id": "chk_1", "link": "https://asaas/checkout/xyz", "status": "PENDING"}),
    ])
    monkeypatch.setattr(asaas_mod, "_request", fake)

    long_desc = "Ingresso Full Experience VIP Premium (1x) — Ozoxx Experience"
    result = _run(asaas_mod.create_checkout(
        order_id="ord_test",
        customer_name="Fulano",
        customer_email="fulano@example.com",
        customer_cpf="39053344705",
        customer_phone="11999999999",
        amount=1200.0,
        description=long_desc,
        success_url="https://ozoxx.com/ok",
        cancel_url="https://ozoxx.com/cancel",
        expired_url="https://ozoxx.com/exp",
    ))

    assert result["success"] is True
    assert len(fake.calls) == 1
    checkout_body = fake.calls[0]["body"]
    assert set(checkout_body["billingTypes"]) == {"PIX", "CREDIT_CARD"}
    assert "DETACHED" in checkout_body["chargeTypes"]
    assert "INSTALLMENT" in checkout_body["chargeTypes"]
    assert len(checkout_body["items"][0]["name"]) <= 30
    assert "customer" not in checkout_body
    assert checkout_body["customerData"]["cpfCnpj"] == "39053344705"
    assert "installment" in checkout_body  # installment obj required when INSTALLMENT is in chargeTypes


def test_create_checkout_pix_only(monkeypatch):
    """payment_method='pix' — only PIX billingType, no installment, chargeTypes=[DETACHED]."""
    fake = _FakeRequest([(True, {"id": "chk_pix", "link": "u", "status": "PENDING"})])
    monkeypatch.setattr(asaas_mod, "_request", fake)

    _run(asaas_mod.create_checkout(
        order_id="ord_pix",
        customer_name="F", customer_email="f@e.com",
        customer_cpf="39053344705", customer_phone="",
        amount=1200.0, description="Ingresso",
        success_url="u", cancel_url="u", expired_url="u",
        payment_method="pix",
    ))
    body = fake.calls[0]["body"]
    assert body["billingTypes"] == ["PIX"]
    assert body["chargeTypes"] == ["DETACHED"]
    # installment object must NOT be present (PIX is single-payment)
    assert "installment" not in body


def test_create_checkout_credit_card_only(monkeypatch):
    """payment_method='credit_card' — only CREDIT_CARD, chargeTypes=[DETACHED, INSTALLMENT] + installment obj."""
    fake = _FakeRequest([(True, {"id": "chk_cc", "link": "u", "status": "PENDING"})])
    monkeypatch.setattr(asaas_mod, "_request", fake)

    _run(asaas_mod.create_checkout(
        order_id="ord_cc",
        customer_name="F", customer_email="f@e.com",
        customer_cpf="39053344705", customer_phone="",
        amount=1300.0, description="Ingresso",
        success_url="u", cancel_url="u", expired_url="u",
        payment_method="credit_card",
        max_installment_count=12,
    ))
    body = fake.calls[0]["body"]
    assert body["billingTypes"] == ["CREDIT_CARD"]
    assert set(body["chargeTypes"]) == {"DETACHED", "INSTALLMENT"}
    assert body["installment"]["maxInstallmentCount"] == 12


def test_create_checkout_forwards_address(monkeypatch):
    """Asaas requires address fields on customerData when not linking by customer id."""
    fake = _FakeRequest([
        (True, {"id": "chk_2", "link": "https://asaas/x", "status": "PENDING"}),
    ])
    monkeypatch.setattr(asaas_mod, "_request", fake)

    result = _run(asaas_mod.create_checkout(
        order_id="ord_addr",
        customer_name="Maria da Silva",
        customer_email="maria@example.com",
        customer_cpf="39053344705",
        customer_phone="11999999999",
        amount=100.0,
        description="Ingresso VIP (1x) — Ozoxx",
        success_url="https://ozoxx.com/ok",
        cancel_url="https://ozoxx.com/cancel",
        expired_url="https://ozoxx.com/exp",
        customer_postal_code="01310-100",
        customer_address="Av. Paulista",
        customer_address_number="1000",
        customer_complement="Sala 42",
        customer_neighborhood="Bela Vista",
        customer_city="São Paulo",
        customer_state="sp",
    ))
    assert result["success"] is True
    cd = fake.calls[0]["body"]["customerData"]
    assert cd["postalCode"] == "01310100"  # digits only
    assert cd["address"] == "Av. Paulista"
    assert cd["addressNumber"] == "1000"
    assert cd["complement"] == "Sala 42"
    assert cd["province"] == "Bela Vista"  # Asaas calls neighborhood "province"
    assert cd["cityName"] == "São Paulo"
    assert cd["state"] == "SP"  # uppercased, 2 chars
