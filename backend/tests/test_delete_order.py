"""Tests for DELETE /api/admin/orders-actions/{order_id}"""
import os
import secrets
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ozoxx.com"
ADMIN_PASSWORD = "OzoxxAdmin@2025"

S = {}


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


class TestDeleteOrderBootstrap:
    def test_login_and_ctx(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        S["admin_token"] = r.json()["access_token"]

        r = requests.get(f"{API}/public/config")
        assert r.status_code == 200
        d = r.json()
        S["ticket_type_id"] = d["tickets"][0]["ticket_type_id"]
        lots = [l for l in d["lots"] if l["ticket_type_id"] == S["ticket_type_id"] and l.get("is_active")]
        S["lot_id"] = lots[0]["lot_id"]


class TestDeleteOrder:
    def _create_paid_order(self, holder="TEST Del"):
        r = requests.post(f"{API}/orders", json={
            "ticket_type_id": S["ticket_type_id"], "lot_id": S["lot_id"],
            "holder_name": holder,
            "holder_email": f"test_del_{secrets.token_hex(4)}@example.com",
            "payment_method": "pix",
            "account_password": "Passw0rd!",
        })
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]
        # move to PAID to create credentials
        r = requests.put(f"{API}/admin/orders-actions/{oid}/status",
                         json={"status": "PAID"}, headers=_auth(S["admin_token"]))
        assert r.status_code == 200
        return oid

    def test_delete_rbac_no_auth(self):
        r = requests.delete(f"{API}/admin/orders-actions/anything")
        assert r.status_code in (401, 403)

    def test_delete_non_existent_404(self):
        r = requests.delete(f"{API}/admin/orders-actions/ord_does_not_exist_xyz",
                            headers=_auth(S["admin_token"]))
        assert r.status_code == 404

    def test_delete_removes_order_and_credentials(self):
        oid = self._create_paid_order("TEST Del Full")
        # sanity: credentials exist
        r = requests.get(f"{API}/orders/{oid}", headers=_auth(S["admin_token"]))
        assert r.status_code == 200
        assert len(r.json().get("credentials", [])) >= 1

        r = requests.delete(f"{API}/admin/orders-actions/{oid}",
                            headers=_auth(S["admin_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("credentials_deleted", 0) >= 1
        assert "checkins_deleted" in body

        # verify order gone
        r = requests.get(f"{API}/orders/{oid}", headers=_auth(S["admin_token"]))
        assert r.status_code == 404

    def test_delete_non_admin_rejected(self):
        # register a normal user (guest checkout creates one)
        email = f"test_nonadmin_{secrets.token_hex(3)}@example.com"
        pw = "Passw0rd!"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Non Admin", "email": email, "password": pw
        })
        assert r.status_code in (200, 201), r.text
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200
        user_token = r.json()["access_token"]

        # create a target order to attempt to delete
        oid = self._create_paid_order("TEST Del Guarded")
        r = requests.delete(f"{API}/admin/orders-actions/{oid}",
                            headers=_auth(user_token))
        assert r.status_code in (401, 403), f"expected auth error, got {r.status_code}: {r.text}"

        # cleanup with admin
        requests.delete(f"{API}/admin/orders-actions/{oid}",
                        headers=_auth(S["admin_token"]))
