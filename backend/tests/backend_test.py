"""
Backend tests for Ozoxx Experience MVP.
Covers: public config, auth, admin endpoints, orders, scanner, role-based access.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ozoxx-experience.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ozoxx.com"
ADMIN_PASSWORD = "OzoxxAdmin@2025"

# Shared state across tests in this module
STATE = {}


# ---------- helpers ----------
def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Health / Public ----------
class TestPublic:
    def test_health(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_public_config(self):
        r = requests.get(f"{API}/public/config")
        assert r.status_code == 200
        data = r.json()
        assert "event" in data and "appearance" in data and "tickets" in data
        assert data["event"]["name"]
        assert isinstance(data["tickets"], list)
        # store a ticket id for later use
        active = [t for t in data["tickets"] if t.get("is_active")]
        assert len(active) >= 1, "Expected at least one active ticket from seed"
        STATE["ticket_type_id"] = active[0]["ticket_type_id"]
        STATE["ticket_price"] = active[0]["price"]


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, f"Login failed: {r.text}"
        data = r.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL
        # Cookies should be set
        assert "access_token" in r.cookies or any(c.name == "access_token" for c in r.cookies)
        STATE["admin_token"] = data["access_token"]
        STATE["admin_user_id"] = data["user"]["user_id"]

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_bearer(self):
        token = STATE.get("admin_token")
        assert token, "admin token missing"
        r = requests.get(f"{API}/auth/me", headers=_auth(token))
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "admin"

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_new_participant(self):
        unique = f"test_user_{int(time.time())}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Participant",
            "email": unique,
            "password": "Senha@2025",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["role"] == "participante"
        assert data["user"]["email"] == unique
        STATE["participant_token"] = data["access_token"]
        STATE["participant_email"] = unique
        STATE["participant_user_id"] = data["user"]["user_id"]

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "Dup", "email": STATE["participant_email"], "password": "Senha@2025",
        })
        assert r.status_code == 400


# ---------- Admin appearance/event ----------
class TestAdminAppearanceAndEvent:
    def test_get_appearance(self):
        r = requests.get(f"{API}/admin/appearance", headers=_auth(STATE["admin_token"]))
        assert r.status_code == 200
        assert "primary_color" in r.json()

    def test_update_appearance(self):
        payload = {
            "logo_url": "https://example.com/logo.png",
            "primary_color": "#28b9fc",
            "secondary_color": "#18245a",
            "background_color": "#070711",
            "hero_image_url": "https://example.com/h.jpg",
            "gallery_images": ["https://example.com/g.jpg"],
            "faq": [{"q": "Q1", "a": "A1"}],
        }
        r = requests.put(f"{API}/admin/appearance", headers=_auth(STATE["admin_token"]), json=payload)
        assert r.status_code == 200
        # Verify persistence
        g = requests.get(f"{API}/admin/appearance", headers=_auth(STATE["admin_token"]))
        assert g.json().get("logo_url") == "https://example.com/logo.png"

    def test_get_event(self):
        r = requests.get(f"{API}/admin/event", headers=_auth(STATE["admin_token"]))
        assert r.status_code == 200
        assert r.json().get("name")

    def test_update_event(self):
        cur = requests.get(f"{API}/admin/event", headers=_auth(STATE["admin_token"])).json()
        cur["name"] = "Ozoxx Experience TEST"
        r = requests.put(f"{API}/admin/event", headers=_auth(STATE["admin_token"]), json=cur)
        assert r.status_code == 200
        g = requests.get(f"{API}/admin/event", headers=_auth(STATE["admin_token"])).json()
        assert g["name"] == "Ozoxx Experience TEST"
        # restore name (best-effort)
        cur["name"] = "Ozoxx Experience"
        requests.put(f"{API}/admin/event", headers=_auth(STATE["admin_token"]), json=cur)


# ---------- Admin tickets ----------
class TestAdminTickets:
    def test_create_ticket(self):
        payload = {"name": "TEST_Premium", "description": "test premium", "price": 1500,
                   "quantity_available": 50, "is_active": True}
        r = requests.post(f"{API}/admin/tickets", headers=_auth(STATE["admin_token"]), json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_Premium"
        assert data["price"] == 1500
        assert "ticket_type_id" in data
        STATE["test_ticket_id"] = data["ticket_type_id"]

    def test_list_tickets(self):
        r = requests.get(f"{API}/admin/tickets", headers=_auth(STATE["admin_token"]))
        assert r.status_code == 200
        items = r.json()
        ids = [t["ticket_type_id"] for t in items]
        assert STATE["test_ticket_id"] in ids

    def test_update_ticket_price(self):
        r = requests.put(f"{API}/admin/tickets/{STATE['test_ticket_id']}",
                         headers=_auth(STATE["admin_token"]), json={"price": 1700})
        assert r.status_code == 200
        items = requests.get(f"{API}/admin/tickets", headers=_auth(STATE["admin_token"])).json()
        match = [t for t in items if t["ticket_type_id"] == STATE["test_ticket_id"]][0]
        assert match["price"] == 1700

    def test_delete_ticket(self):
        r = requests.delete(f"{API}/admin/tickets/{STATE['test_ticket_id']}",
                            headers=_auth(STATE["admin_token"]))
        assert r.status_code == 200
        items = requests.get(f"{API}/admin/tickets", headers=_auth(STATE["admin_token"])).json()
        ids = [t["ticket_type_id"] for t in items]
        assert STATE["test_ticket_id"] not in ids


# ---------- Admin users ----------
class TestAdminUsers:
    def test_create_credenciadora(self):
        email = f"test_cred_{int(time.time())}@example.com"
        payload = {"name": "TEST Cred", "email": email, "password": "Senha@2025", "role": "credenciadora"}
        r = requests.post(f"{API}/admin/users", headers=_auth(STATE["admin_token"]), json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "credenciadora"
        assert data["email"] == email
        STATE["cred_user_id"] = data["user_id"]
        STATE["cred_email"] = email
        STATE["cred_password"] = "Senha@2025"

    def test_list_users(self):
        r = requests.get(f"{API}/admin/users", headers=_auth(STATE["admin_token"]))
        assert r.status_code == 200
        ids = [u["user_id"] for u in r.json()]
        assert STATE["cred_user_id"] in ids

    def test_update_user_role(self):
        r = requests.put(f"{API}/admin/users/{STATE['cred_user_id']}",
                         headers=_auth(STATE["admin_token"]), json={"role": "financeiro"})
        assert r.status_code == 200
        users = requests.get(f"{API}/admin/users", headers=_auth(STATE["admin_token"])).json()
        u = [x for x in users if x["user_id"] == STATE["cred_user_id"]][0]
        assert u["role"] == "financeiro"
        # Restore role for scanner tests
        requests.put(f"{API}/admin/users/{STATE['cred_user_id']}",
                     headers=_auth(STATE["admin_token"]), json={"role": "credenciadora"})

    def test_delete_self_blocked(self):
        r = requests.delete(f"{API}/admin/users/{STATE['admin_user_id']}",
                            headers=_auth(STATE["admin_token"]))
        assert r.status_code == 400

    def test_login_credenciadora(self):
        # Login as the credenciadora user we just created (and restored role)
        r = requests.post(f"{API}/auth/login",
                          json={"email": STATE["cred_email"], "password": STATE["cred_password"]})
        assert r.status_code == 200, r.text
        STATE["cred_token"] = r.json()["access_token"]
        assert r.json()["user"]["role"] == "credenciadora"


# ---------- Admin integrations ----------
class TestAdminIntegrations:
    def test_put_integrations(self):
        payload = {"pagbank_email": "", "pagbank_token": "", "pagbank_sandbox": True,
                   "pagbank_webhook_secret": "", "resend_api_key": "", "resend_sender": "onboarding@resend.dev"}
        r = requests.put(f"{API}/admin/integrations", headers=_auth(STATE["admin_token"]), json=payload)
        assert r.status_code == 200

    def test_test_pagbank_graceful(self):
        r = requests.post(f"{API}/admin/integrations/test-pagbank", headers=_auth(STATE["admin_token"]))
        # Must not be 500 — should return a graceful response
        assert r.status_code in (200, 400), f"Unexpected status: {r.status_code} body={r.text}"
        if r.status_code == 200:
            data = r.json()
            assert "success" in data
            assert "message" in data
            # With empty token, should NOT succeed
            assert data["success"] is False

    def test_test_resend_empty_key(self):
        r = requests.post(f"{API}/admin/integrations/test-resend", headers=_auth(STATE["admin_token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is False
        assert "Resend" in data["message"] or "não" in data["message"].lower()


# ---------- Admin stats ----------
class TestAdminStats:
    def test_stats(self):
        r = requests.get(f"{API}/admin/stats", headers=_auth(STATE["admin_token"]))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_users", "total_orders", "paid_orders", "pending_orders",
                  "total_credentials", "checked_in", "revenue"]:
            assert k in d


# ---------- Orders ----------
class TestOrders:
    def test_create_order_guest_missing_holder(self):
        r = requests.post(f"{API}/orders",
                          json={"ticket_type_id": STATE["ticket_type_id"], "has_companion": False,
                                "payment_method": "pix"})
        assert r.status_code == 400

    def test_create_order_guest_ok(self):
        payload = {
            "ticket_type_id": STATE["ticket_type_id"],
            "has_companion": False,
            "payment_method": "pix",
            "holder_name": "TEST Guest",
            "holder_email": "test_guest@example.com",
            "holder_cpf": "12345678900",
            "holder_phone": "11999999999",
        }
        r = requests.post(f"{API}/orders", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "order_id" in d
        assert d["status"] == "WAITING"
        # PagBank not configured → payment_ready should be False but order still created
        STATE["order_id"] = d["order_id"]

    def test_create_order_has_companion_missing(self):
        payload = {
            "ticket_type_id": STATE["ticket_type_id"], "has_companion": True,
            "payment_method": "pix", "holder_name": "x", "holder_email": "x@x.com",
        }
        r = requests.post(f"{API}/orders", json=payload)
        assert r.status_code == 400

    def test_create_order_with_companion(self):
        payload = {
            "ticket_type_id": STATE["ticket_type_id"],
            "has_companion": True,
            "companion": {"name": "TEST Comp", "email": "test_comp@example.com"},
            "payment_method": "pix",
            "holder_name": "TEST Holder2",
            "holder_email": STATE["participant_email"],  # match participant to test /api/me/credentials
        }
        r = requests.post(f"{API}/orders", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["has_companion"] is True
        assert d["quantity"] == 2
        STATE["order_id_companion"] = d["order_id"]

    def test_simulate_pay_generates_credentials(self):
        oid = STATE["order_id_companion"]
        r = requests.post(f"{API}/orders/{oid}/simulate-pay")
        assert r.status_code == 200, r.text

        g = requests.get(f"{API}/orders/{oid}")
        assert g.status_code == 200
        order = g.json()
        assert order["status"] == "PAID"
        assert len(order["credentials"]) == 2
        STATE["holder_cred_code"] = next(c["credential_code"] for c in order["credentials"] if not c["is_companion"])
        STATE["companion_cred_code"] = next(c["credential_code"] for c in order["credentials"] if c["is_companion"])

    def test_get_order_after_pay(self):
        r = requests.get(f"{API}/orders/{STATE['order_id_companion']}")
        assert r.status_code == 200
        assert r.json()["status"] == "PAID"

    def test_retry_returns_502_when_pagbank_unconfigured(self):
        # Create new waiting order
        payload = {
            "ticket_type_id": STATE["ticket_type_id"], "has_companion": False,
            "payment_method": "pix", "holder_name": "TEST Retry",
            "holder_email": "test_retry@example.com",
        }
        r = requests.post(f"{API}/orders", json=payload)
        oid = r.json()["order_id"]
        rr = requests.post(f"{API}/orders/{oid}/retry")
        # PagBank not configured → should be 502 graceful (or 200 if somehow succeeds)
        assert rr.status_code in (200, 502), f"Got {rr.status_code}: {rr.text}"


# ---------- Scanner ----------
class TestScanner:
    def test_scanner_requires_credenciadora_role(self):
        # Participant should be 403
        r = requests.post(f"{API}/scanner/validate",
                          headers=_auth(STATE["participant_token"]),
                          json={"code": "OZX-XXXX"})
        assert r.status_code == 403

    def test_scanner_invalid_code(self):
        r = requests.post(f"{API}/scanner/validate",
                          headers=_auth(STATE["cred_token"]),
                          json={"code": "OZX-INVALID"})
        assert r.status_code == 200
        d = r.json()
        assert d["valid"] is False
        assert d["reason"] == "not_found"

    def test_scanner_valid_then_already(self):
        code = STATE["holder_cred_code"]
        r1 = requests.post(f"{API}/scanner/validate",
                           headers=_auth(STATE["cred_token"]),
                           json={"code": code})
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["valid"] is True
        # second time
        r2 = requests.post(f"{API}/scanner/validate",
                           headers=_auth(STATE["cred_token"]),
                           json={"code": code})
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["valid"] is False
        assert d2["reason"] == "already_checked_in"

    def test_scanner_recent_checkins(self):
        r = requests.get(f"{API}/scanner/checkins", headers=_auth(STATE["cred_token"]))
        assert r.status_code == 200
        codes = [c["credential_code"] for c in r.json()]
        assert STATE["holder_cred_code"] in codes


# ---------- Participant credentials & public credential ----------
class TestCredentials:
    def test_me_credentials_returns_qr(self):
        # Participant has companion order tied via email
        r = requests.get(f"{API}/me/credentials", headers=_auth(STATE["participant_token"]))
        assert r.status_code == 200, r.text
        creds = r.json()
        assert len(creds) >= 1
        assert creds[0]["qr_png"].startswith("data:image") or creds[0]["qr_png"].startswith("iVBOR") \
            or "base64" in creds[0]["qr_png"]

    def test_public_credential_lookup(self):
        code = STATE["companion_cred_code"]
        r = requests.get(f"{API}/credentials/public/{code}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["credential_code"] == code
        assert "qr_png" in d
        # email should be excluded
        assert "email" not in d

    def test_public_credential_not_found(self):
        r = requests.get(f"{API}/credentials/public/OZX-DOESNOTEXIST")
        assert r.status_code == 404


# ---------- Role-based access ----------
class TestRBAC:
    def test_non_admin_cannot_access_admin(self):
        r = requests.get(f"{API}/admin/users", headers=_auth(STATE["participant_token"]))
        assert r.status_code == 403

    def test_admin_can_access_admin(self):
        r = requests.get(f"{API}/admin/users", headers=_auth(STATE["admin_token"]))
        assert r.status_code == 200


# ---------- Cleanup ----------
@pytest.fixture(scope="module", autouse=True)
def cleanup_after_all():
    yield
    # Best-effort cleanup of TEST_ created users
    token = STATE.get("admin_token")
    if not token:
        return
    try:
        users = requests.get(f"{API}/admin/users", headers=_auth(token)).json()
        for u in users:
            if u.get("email", "").startswith("test_") and u["user_id"] != STATE.get("admin_user_id"):
                requests.delete(f"{API}/admin/users/{u['user_id']}", headers=_auth(token))
    except Exception:
        pass
