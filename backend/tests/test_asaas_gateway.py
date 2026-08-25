"""Asaas gateway backend tests.

Covers:
- Integrations model persists new payment_gateway/asaas_* keys
- /api/admin/asaas/status reflects config
- Order creation with gateway=asaas + no token -> payment_error path
- Order creation with gateway=pagbank (regression) -> unchanged
- /api/webhook/asaas token validation + idempotency + PAID processing
- /api/admin/asaas/register-webhook validation errors

NOTE: real Asaas API calls will fail (no live sandbox token) — we only assert
the error branch. For webhook happy-path we insert an order directly and post
the event to our own endpoint using a preset webhook token.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ozoxx-experience.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@ozoxx.com"
ADMIN_PASS = "OzoxxAdmin@2025"
TICKET_TYPE_ID = "tkt_4abdb0d16618"


# --- fixtures ----------------------------------------------------------------

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    token = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def original_integrations(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/integrations")
    assert r.status_code == 200
    return r.json()


@pytest.fixture(autouse=True)
def _restore_integrations(admin_session, original_integrations):
    """Snapshot before each test, restore after — safe against wipes."""
    yield
    admin_session.put(f"{BASE_URL}/api/admin/integrations", json=original_integrations)


def _put_integrations(sess, **overrides):
    r = sess.get(f"{BASE_URL}/api/admin/integrations")
    doc = r.json()
    doc.update(overrides)
    r2 = sess.put(f"{BASE_URL}/api/admin/integrations", json=doc)
    assert r2.status_code == 200, r2.text
    return doc


def _active_lot_for_ticket(sess):
    r = sess.get(f"{BASE_URL}/api/public/lots")
    assert r.status_code == 200
    for lot in r.json():
        if lot.get("ticket_type_id") == TICKET_TYPE_ID and lot.get("is_active") and lot.get("is_available"):
            return lot
    pytest.skip("no active lot available for ticket_type_id")


# --- 1) integrations persistence --------------------------------------------

class TestIntegrationsSchema:
    def test_put_persists_asaas_and_gateway_keys(self, admin_session):
        payload = _put_integrations(
            admin_session,
            payment_gateway="asaas",
            asaas_environment="sandbox",
            asaas_sandbox_token="TEST_SBX_TKN",
            asaas_production_token="TEST_PRD_TKN",
            asaas_webhook_token="TEST_WHK_TKN_ABCDEF",
        )
        got = admin_session.get(f"{BASE_URL}/api/admin/integrations").json()
        assert got["payment_gateway"] == "asaas"
        assert got["asaas_environment"] == "sandbox"
        assert got["asaas_sandbox_token"] == "TEST_SBX_TKN"
        assert got["asaas_production_token"] == "TEST_PRD_TKN"
        assert got["asaas_webhook_token"] == "TEST_WHK_TKN_ABCDEF"
        # PagBank fields untouched
        assert got.get("pagbank_email") == payload["pagbank_email"]
        assert got.get("pagbank_token") == payload["pagbank_token"]


# --- 2) /api/admin/asaas/status ---------------------------------------------

class TestAsaasStatus:
    def test_status_disabled_when_no_token(self, admin_session):
        _put_integrations(
            admin_session,
            payment_gateway="asaas",
            asaas_environment="sandbox",
            asaas_sandbox_token="",
            asaas_webhook_token="",
        )
        r = admin_session.get(f"{BASE_URL}/api/admin/asaas/status")
        assert r.status_code == 200
        j = r.json()
        assert j["environment"] == "sandbox"
        assert j["enabled"] is False
        assert j["webhook_configured"] is False

    def test_status_enabled_with_token(self, admin_session):
        _put_integrations(
            admin_session,
            payment_gateway="asaas",
            asaas_environment="sandbox",
            asaas_sandbox_token="SOMETOKEN",
            asaas_webhook_token="WHK_SECRET_XYZ",
        )
        r = admin_session.get(f"{BASE_URL}/api/admin/asaas/status")
        j = r.json()
        assert j["enabled"] is True
        assert j["webhook_configured"] is True

    def test_status_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/asaas/status")
        assert r.status_code in (401, 403)


# --- 3) Order creation branching --------------------------------------------

class TestOrderGatewayBranch:
    def test_asaas_gateway_without_token_returns_payment_error(self, admin_session):
        _put_integrations(
            admin_session,
            payment_gateway="asaas",
            asaas_environment="sandbox",
            asaas_sandbox_token="",  # disabled
            asaas_webhook_token="WHK",
        )
        lot = _active_lot_for_ticket(admin_session)
        payload = {
            "ticket_type_id": TICKET_TYPE_ID,
            "lot_id": lot["lot_id"],
            "payment_method": "pix",
            "holder_name": "TEST Asaas NoToken",
            "holder_email": f"test_asaas_no_{uuid.uuid4().hex[:6]}@example.com",
            "holder_cpf": "39053344705",
            "holder_phone": "11999999999",
            "has_companion": False,
            "account_password": "senha123",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, r.text
        order = r.json()
        # Response payment_ready must be False + payment_error present
        assert order.get("payment_ready") is False
        err = (order.get("payment_error") or "").lower()
        assert "asaas" in err or "token" in err or "configurado" in err
        assert not order.get("asaas_checkout_url")
        # Verify DB state via admin GET (response body currently omits gateway field on failure branch — minor bug)
        got = admin_session.get(f"{BASE_URL}/api/orders/{order['order_id']}").json()
        assert got.get("gateway") == "asaas"

    def test_pagbank_gateway_regression(self, admin_session, original_integrations):
        # ensure gateway=pagbank
        _put_integrations(admin_session, payment_gateway="pagbank")
        lot = _active_lot_for_ticket(admin_session)
        payload = {
            "ticket_type_id": TICKET_TYPE_ID,
            "lot_id": lot["lot_id"],
            "payment_method": "pix",
            "holder_name": "TEST PagBank Regress",
            "holder_email": f"test_pb_{uuid.uuid4().hex[:6]}@example.com",
            "holder_cpf": "39053344705",
            "holder_phone": "11999999999",
            "has_companion": False,
            "account_password": "senha123",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, r.text
        order = r.json()
        # Must not be routed to asaas
        assert order.get("gateway") != "asaas"
        assert not order.get("asaas_checkout_url")
        # PagBank fields should be present (either qr_code or an error if pb sandbox down)
        assert "payment_ready" in order


# --- 4) Webhook token validation --------------------------------------------

class TestWebhookAuth:
    def test_missing_header_returns_401(self, admin_session):
        _put_integrations(admin_session, asaas_webhook_token="WHK_TEST_TOKEN_XYZ")
        r = requests.post(f"{BASE_URL}/api/webhook/asaas", json={"id": "evt_x", "event": "PAYMENT_RECEIVED"})
        assert r.status_code == 401

    def test_wrong_header_returns_401(self, admin_session):
        _put_integrations(admin_session, asaas_webhook_token="WHK_TEST_TOKEN_XYZ")
        r = requests.post(
            f"{BASE_URL}/api/webhook/asaas",
            headers={"asaas-access-token": "WRONG"},
            json={"id": "evt_x", "event": "PAYMENT_RECEIVED"},
        )
        assert r.status_code == 401

    def test_no_configured_token_returns_401(self, admin_session):
        _put_integrations(admin_session, asaas_webhook_token="")
        r = requests.post(
            f"{BASE_URL}/api/webhook/asaas",
            headers={"asaas-access-token": "anything"},
            json={"id": "evt_x", "event": "PAYMENT_RECEIVED"},
        )
        assert r.status_code == 401


# --- 5) Webhook happy path + idempotency ------------------------------------

class TestWebhookProcessing:
    def _make_order_asaas_gateway(self, admin_session):
        # Seed webhook token AND ensure gateway=asaas
        _put_integrations(
            admin_session,
            payment_gateway="asaas",
            asaas_webhook_token="WHK_TEST_TOKEN_XYZ",
            asaas_sandbox_token="",  # keep token missing so no external call
        )
        lot = _active_lot_for_ticket(admin_session)
        payload = {
            "ticket_type_id": TICKET_TYPE_ID,
            "lot_id": lot["lot_id"],
            "payment_method": "pix",
            "holder_name": "TEST Webhook Flow",
            "holder_email": f"test_whk_{uuid.uuid4().hex[:6]}@example.com",
            "holder_cpf": "39053344705",
            "holder_phone": "11999999999",
            "has_companion": False,
            "account_password": "senha123",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, r.text
        return r.json()

    def test_payment_received_marks_order_paid(self, admin_session):
        order = self._make_order_asaas_gateway(admin_session)
        event_id = f"evt_{uuid.uuid4().hex}"
        event = {
            "id": event_id,
            "event": "PAYMENT_RECEIVED",
            "payment": {
                "id": f"pay_{uuid.uuid4().hex[:8]}",
                "externalReference": order["order_id"],
                "status": "RECEIVED",
                "value": order["total_amount"],
            },
        }
        r = requests.post(
            f"{BASE_URL}/api/webhook/asaas",
            headers={"asaas-access-token": "WHK_TEST_TOKEN_XYZ"},
            json=event,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        # Verify order status
        got = admin_session.get(f"{BASE_URL}/api/orders/{order['order_id']}")
        assert got.status_code == 200
        assert got.json()["status"] == "PAID"

    def test_webhook_idempotency(self, admin_session):
        order = self._make_order_asaas_gateway(admin_session)
        event_id = f"evt_{uuid.uuid4().hex}"
        event = {
            "id": event_id,
            "event": "PAYMENT_RECEIVED",
            "payment": {
                "id": f"pay_{uuid.uuid4().hex[:8]}",
                "externalReference": order["order_id"],
                "status": "RECEIVED",
                "value": order["total_amount"],
            },
        }
        headers = {"asaas-access-token": "WHK_TEST_TOKEN_XYZ"}
        r1 = requests.post(f"{BASE_URL}/api/webhook/asaas", headers=headers, json=event)
        r2 = requests.post(f"{BASE_URL}/api/webhook/asaas", headers=headers, json=event)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r2.json().get("duplicate") is True


# --- 6) register-webhook admin endpoint -------------------------------------

class TestRegisterWebhookAdmin:
    def test_400_when_token_missing(self, admin_session):
        _put_integrations(
            admin_session,
            asaas_environment="sandbox",
            asaas_sandbox_token="",  # not enabled
            asaas_webhook_token="",
        )
        r = admin_session.post(f"{BASE_URL}/api/admin/asaas/register-webhook")
        assert r.status_code == 400
        assert "API" in r.text or "Asaas" in r.text

    def test_400_when_webhook_token_missing(self, admin_session):
        _put_integrations(
            admin_session,
            asaas_environment="sandbox",
            asaas_sandbox_token="ANYTKN",  # enabled
            asaas_webhook_token="",  # missing
        )
        r = admin_session.post(f"{BASE_URL}/api/admin/asaas/register-webhook")
        assert r.status_code == 400
        assert "Webhook" in r.text or "webhook" in r.text
