"""Tests for coupon per-user usage limit (max_uses_per_user)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@ozoxx.com"
ADMIN_PASSWORD = "OzoxxAdmin@2025"
TICKET_TYPE_ID = "tkt_4abdb0d16618"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def active_lot():
    r = requests.get(f"{BASE_URL}/api/public/lots")
    assert r.status_code == 200
    for lot in r.json():
        if lot.get("ticket_type_id") == TICKET_TYPE_ID and lot.get("is_available"):
            return lot
    pytest.skip("no active lot available")


def _make_coupon(admin_session, max_uses_per_user=None, max_uses=None):
    code = f"TESTPU{uuid.uuid4().hex[:6].upper()}"
    body = {
        "code": code,
        "description": "TEST per-user coupon",
        "discount_type": "percent",
        "discount_value": 10,
        "is_active": True,
    }
    if max_uses_per_user is not None:
        body["max_uses_per_user"] = max_uses_per_user
    if max_uses is not None:
        body["max_uses"] = max_uses
    r = admin_session.post(f"{BASE_URL}/api/admin/coupons", json=body)
    assert r.status_code in (200, 201), f"create coupon failed: {r.status_code} {r.text}"
    return r.json()


def _order_payload(code, email, lot_id):
    return {
        "ticket_type_id": TICKET_TYPE_ID,
        "lot_id": lot_id,
        "has_companion": False,
        "payment_method": "pix",
        "coupon_code": code,
        "holder_name": "TEST Buyer",
        "holder_email": email,
        "holder_cpf": "12345678909",
        "holder_phone": "11999999999",
        "account_password": "Passw0rd!",
    }


class TestPerUserLimit:
    def test_create_and_persist_max_uses_per_user(self, admin_session):
        cup = _make_coupon(admin_session, max_uses_per_user=2)
        try:
            assert cup.get("max_uses_per_user") == 2
            r = admin_session.get(f"{BASE_URL}/api/admin/coupons")
            found = next((c for c in r.json() if c["coupon_id"] == cup["coupon_id"]), None)
            assert found and found.get("max_uses_per_user") == 2
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_update_max_uses_per_user_persists(self, admin_session):
        cup = _make_coupon(admin_session, max_uses_per_user=1)
        try:
            r = admin_session.put(
                f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}",
                json={"max_uses_per_user": 5},
            )
            assert r.status_code == 200
            r = admin_session.get(f"{BASE_URL}/api/admin/coupons")
            found = next((c for c in r.json() if c["coupon_id"] == cup["coupon_id"]), None)
            assert found["max_uses_per_user"] == 5
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_validate_endpoint_enforces_per_user_limit(self, admin_session, active_lot):
        cup = _make_coupon(admin_session, max_uses_per_user=1)
        email = f"peruser_{uuid.uuid4().hex[:6]}@example.com"
        order_ids = []
        try:
            # Under limit → 200
            r = requests.get(f"{BASE_URL}/api/coupons/validate/{cup['code']}", params={"email": email})
            assert r.status_code == 200, r.text

            # Create 1 order → hits limit
            r = requests.post(f"{BASE_URL}/api/orders", json=_order_payload(cup["code"], email, active_lot["lot_id"]))
            assert r.status_code == 200, r.text
            order_ids.append(r.json()["order_id"])

            # Now at limit → validate blocks
            r = requests.get(f"{BASE_URL}/api/coupons/validate/{cup['code']}", params={"email": email})
            assert r.status_code == 400, r.text
            detail = r.json()["detail"]
            assert "já usou" in detail.lower() and "limite: 1" in detail
        finally:
            for oid in order_ids:
                try:
                    admin_session.delete(f"{BASE_URL}/api/admin/orders-actions/{oid}")
                except Exception:
                    pass
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_order_creation_enforces_per_user_limit(self, admin_session, active_lot):
        cup = _make_coupon(admin_session, max_uses_per_user=2)
        email = f"peruserord_{uuid.uuid4().hex[:6]}@example.com"
        order_ids = []
        try:
            # 1st order
            r = requests.post(f"{BASE_URL}/api/orders", json=_order_payload(cup["code"], email, active_lot["lot_id"]))
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("coupon_code") == cup["code"]
            assert data.get("discount", 0) > 0
            order_ids.append(data["order_id"])

            # 2nd order — still under limit (2)
            # Login as this user since account was created; but /api/orders accepts logged-in optionally.
            # Since /api/orders on guest requires "no existing user" — user was created on 1st call.
            # So we need to login to make 2nd order.
            us = requests.Session()
            lr = us.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "Passw0rd!"})
            assert lr.status_code == 200, lr.text
            payload2 = _order_payload(cup["code"], email, active_lot["lot_id"])
            payload2.pop("account_password", None)
            r = us.post(f"{BASE_URL}/api/orders", json=payload2)
            assert r.status_code == 200, f"2nd order should succeed: {r.status_code} {r.text}"
            order_ids.append(r.json()["order_id"])

            # 3rd order — should hit limit
            r = us.post(f"{BASE_URL}/api/orders", json=payload2)
            assert r.status_code == 400, f"3rd should be blocked, got {r.status_code}: {r.text}"
            detail = r.json()["detail"]
            assert "já usou" in detail.lower() and "limite: 2" in detail
        finally:
            for oid in order_ids:
                try:
                    admin_session.delete(f"{BASE_URL}/api/admin/orders-actions/{oid}")
                except Exception:
                    pass
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_different_emails_do_not_share_counter(self, admin_session, active_lot):
        cup = _make_coupon(admin_session, max_uses_per_user=1)
        email_a = f"userA_{uuid.uuid4().hex[:6]}@example.com"
        email_b = f"userB_{uuid.uuid4().hex[:6]}@example.com"
        order_ids = []
        try:
            r = requests.post(f"{BASE_URL}/api/orders", json=_order_payload(cup["code"], email_a, active_lot["lot_id"]))
            assert r.status_code == 200, r.text
            order_ids.append(r.json()["order_id"])

            # User B — fresh counter → should succeed
            r = requests.post(f"{BASE_URL}/api/orders", json=_order_payload(cup["code"], email_b, active_lot["lot_id"]))
            assert r.status_code == 200, f"user B should not be blocked: {r.status_code} {r.text}"
            order_ids.append(r.json()["order_id"])
        finally:
            for oid in order_ids:
                try:
                    admin_session.delete(f"{BASE_URL}/api/admin/orders-actions/{oid}")
                except Exception:
                    pass
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_null_max_uses_per_user_is_unlimited(self, admin_session, active_lot):
        cup = _make_coupon(admin_session, max_uses_per_user=None)
        email = f"unl_{uuid.uuid4().hex[:6]}@example.com"
        order_ids = []
        try:
            # Two orders same email should both succeed
            r = requests.post(f"{BASE_URL}/api/orders", json=_order_payload(cup["code"], email, active_lot["lot_id"]))
            assert r.status_code == 200, r.text
            order_ids.append(r.json()["order_id"])

            us = requests.Session()
            us.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "Passw0rd!"})
            p2 = _order_payload(cup["code"], email, active_lot["lot_id"])
            p2.pop("account_password", None)
            r = us.post(f"{BASE_URL}/api/orders", json=p2)
            assert r.status_code == 200, r.text
            order_ids.append(r.json()["order_id"])
        finally:
            for oid in order_ids:
                try:
                    admin_session.delete(f"{BASE_URL}/api/admin/orders-actions/{oid}")
                except Exception:
                    pass
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_max_uses_total_still_enforced_independently(self, admin_session, active_lot):
        # max_uses=1 (total), max_uses_per_user None
        cup = _make_coupon(admin_session, max_uses=1)
        email_a = f"totA_{uuid.uuid4().hex[:6]}@example.com"
        email_b = f"totB_{uuid.uuid4().hex[:6]}@example.com"
        order_ids = []
        try:
            r = requests.post(f"{BASE_URL}/api/orders", json=_order_payload(cup["code"], email_a, active_lot["lot_id"]))
            assert r.status_code == 200, r.text
            order_ids.append(r.json()["order_id"])

            # Second use by different email — should be blocked by max_uses total
            r = requests.get(f"{BASE_URL}/api/coupons/validate/{cup['code']}", params={"email": email_b})
            assert r.status_code == 400, r.text
            assert "esgotado" in r.json()["detail"].lower()
        finally:
            for oid in order_ids:
                try:
                    admin_session.delete(f"{BASE_URL}/api/admin/orders-actions/{oid}")
                except Exception:
                    pass
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")
