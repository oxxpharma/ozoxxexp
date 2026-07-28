"""Tests for coupon user-restriction feature (allowed_user_ids).

Covers:
- POST /api/admin/coupons with allowed_user_ids
- GET /api/admin/coupons enriches with allowed_users
- GET /api/coupons/validate/{code}?email=... enforces restriction
- POST /api/orders enforces coupon restriction server-side
- Open coupon still works for anyone
"""
import os
import time
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
def allowed_user(admin_session):
    """Create a TEST participant user, return dict + password. Cleanup after."""
    email = f"test_coupon_user_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass123!"
    payload = {
        "name": "TEST Coupon User",
        "email": email,
        "password": password,
        "role": "participante",
    }
    r = admin_session.post(f"{BASE_URL}/api/admin/users", json=payload)
    assert r.status_code in (200, 201), f"create user failed: {r.status_code} {r.text}"
    data = r.json()
    user_id = data.get("user_id") or data.get("id")
    yield {"user_id": user_id, "email": email, "password": password}
    # cleanup
    try:
        admin_session.delete(f"{BASE_URL}/api/admin/users/{user_id}")
    except Exception:
        pass


@pytest.fixture(scope="module")
def active_lot():
    """Fetch first available active lot for the seeded ticket type."""
    r = requests.get(f"{BASE_URL}/api/public/lots")
    assert r.status_code == 200
    lots = r.json()
    for lot in lots:
        if lot.get("ticket_type_id") == TICKET_TYPE_ID and lot.get("is_available"):
            return lot
    pytest.skip("no active lot available")


def _make_coupon(admin_session, allowed_user_ids=None):
    code = f"TEST{uuid.uuid4().hex[:6].upper()}"
    body = {
        "code": code,
        "description": "TEST coupon",
        "discount_type": "percent",
        "discount_value": 10,
        "is_active": True,
    }
    if allowed_user_ids is not None:
        body["allowed_user_ids"] = allowed_user_ids
    r = admin_session.post(f"{BASE_URL}/api/admin/coupons", json=body)
    assert r.status_code in (200, 201), f"create coupon failed: {r.status_code} {r.text}"
    return r.json()


class TestCouponRestriction:
    def test_create_restricted_coupon_and_list_enriches(self, admin_session, allowed_user):
        cup = _make_coupon(admin_session, allowed_user_ids=[allowed_user["user_id"]])
        try:
            assert cup["allowed_user_ids"] == [allowed_user["user_id"]]
            # list should enrich
            r = admin_session.get(f"{BASE_URL}/api/admin/coupons")
            assert r.status_code == 200
            found = next((c for c in r.json() if c["coupon_id"] == cup["coupon_id"]), None)
            assert found is not None
            assert "allowed_users" in found
            assert len(found["allowed_users"]) == 1
            assert found["allowed_users"][0]["email"] == allowed_user["email"]
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_open_coupon_list_has_empty_allowed_users(self, admin_session):
        cup = _make_coupon(admin_session, allowed_user_ids=None)
        try:
            r = admin_session.get(f"{BASE_URL}/api/admin/coupons")
            found = next((c for c in r.json() if c["coupon_id"] == cup["coupon_id"]), None)
            assert found is not None
            assert found.get("allowed_users") == []
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_validate_restricted_missing_email(self, admin_session, allowed_user):
        cup = _make_coupon(admin_session, allowed_user_ids=[allowed_user["user_id"]])
        try:
            r = requests.get(f"{BASE_URL}/api/coupons/validate/{cup['code']}")
            assert r.status_code == 400, r.text
            assert "exclusivo" in r.json()["detail"].lower()
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_validate_restricted_wrong_email(self, admin_session, allowed_user):
        cup = _make_coupon(admin_session, allowed_user_ids=[allowed_user["user_id"]])
        try:
            r = requests.get(
                f"{BASE_URL}/api/coupons/validate/{cup['code']}",
                params={"email": "otheruser@example.com"},
            )
            assert r.status_code == 403, r.text
            assert "não é válido" in r.json()["detail"].lower() or "nao e valido" in r.json()["detail"].lower()
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_validate_restricted_correct_email_case_insensitive(self, admin_session, allowed_user):
        cup = _make_coupon(admin_session, allowed_user_ids=[allowed_user["user_id"]])
        try:
            r = requests.get(
                f"{BASE_URL}/api/coupons/validate/{cup['code']}",
                params={"email": allowed_user["email"].upper()},
            )
            assert r.status_code == 200, r.text
            assert r.json()["code"] == cup["code"]
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_validate_open_coupon_no_email_required(self, admin_session):
        cup = _make_coupon(admin_session, allowed_user_ids=None)
        try:
            r = requests.get(f"{BASE_URL}/api/coupons/validate/{cup['code']}")
            assert r.status_code == 200, r.text
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_order_creation_blocked_for_non_allowed_email(self, admin_session, allowed_user, active_lot):
        cup = _make_coupon(admin_session, allowed_user_ids=[allowed_user["user_id"]])
        try:
            wrong_email = f"wrong_{uuid.uuid4().hex[:6]}@example.com"
            payload = {
                "ticket_type_id": TICKET_TYPE_ID,
                "lot_id": active_lot["lot_id"],
                "has_companion": False,
                "payment_method": "pix",
                "coupon_code": cup["code"],
                "holder_name": "TEST Wrong Buyer",
                "holder_email": wrong_email,
                "holder_cpf": "12345678909",
                "holder_phone": "11999999999",
                "account_password": "Passw0rd!",
            }
            r = requests.post(f"{BASE_URL}/api/orders", json=payload)
            assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
            assert "não é válido" in r.json()["detail"].lower()
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_order_creation_allowed_for_matching_email_applies_discount(self, admin_session, allowed_user, active_lot):
        cup = _make_coupon(admin_session, allowed_user_ids=[allowed_user["user_id"]])
        order_id = None
        try:
            # Login as the allowed user
            us = requests.Session()
            lr = us.post(f"{BASE_URL}/api/auth/login", json={"email": allowed_user["email"], "password": allowed_user["password"]})
            assert lr.status_code == 200, lr.text
            payload = {
                "ticket_type_id": TICKET_TYPE_ID,
                "lot_id": active_lot["lot_id"],
                "has_companion": False,
                "payment_method": "pix",
                "coupon_code": cup["code"],
                "holder_name": "TEST Allowed Buyer",
                "holder_email": allowed_user["email"],
                "holder_cpf": "12345678909",
                "holder_phone": "11999999999",
            }
            r = us.post(f"{BASE_URL}/api/orders", json=payload)
            assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
            data = r.json()
            order_id = data["order_id"]
            assert data.get("coupon_code") == cup["code"]
            assert data.get("discount", 0) > 0, "discount should be applied"
        finally:
            if order_id:
                try:
                    admin_session.delete(f"{BASE_URL}/api/admin/orders-actions/{order_id}")
                except Exception:
                    pass
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")

    def test_update_coupon_repopulates_allowed_users(self, admin_session, allowed_user):
        cup = _make_coupon(admin_session, allowed_user_ids=None)
        try:
            r = admin_session.put(
                f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}",
                json={"allowed_user_ids": [allowed_user["user_id"]]},
            )
            assert r.status_code == 200
            r = admin_session.get(f"{BASE_URL}/api/admin/coupons")
            found = next((c for c in r.json() if c["coupon_id"] == cup["coupon_id"]), None)
            assert found is not None
            assert found["allowed_user_ids"] == [allowed_user["user_id"]]
            assert len(found["allowed_users"]) == 1
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/coupons/{cup['coupon_id']}")
