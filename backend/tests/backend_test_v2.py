"""
Backend tests for Ozoxx Experience v2 — lots, coupons, leaders, emails,
password reset, PDF credentials, UTM tracking + analytics, abandoned carts,
manual courtesy, uploads, RBAC.
"""
import os
import io
import time
import secrets
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://ozoxx-experience.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ozoxx.com"
ADMIN_PASSWORD = "OzoxxAdmin@2025"

S = {}  # shared state


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- bootstrap: admin login + ticket/lot context ----------
class TestBootstrap:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        d = r.json()
        S["admin_token"] = d["access_token"]
        S["admin_user_id"] = d["user"]["user_id"]
        assert d["user"]["role"] == "admin"

    def test_public_config_lots(self):
        r = requests.get(f"{API}/public/config")
        assert r.status_code == 200
        d = r.json()
        assert "lots" in d and "current_lots" in d and "tickets" in d
        assert isinstance(d["lots"], list) and len(d["lots"]) >= 1
        tkt = d["tickets"][0]
        S["ticket_type_id"] = tkt["ticket_type_id"]
        # pick the cheapest lot belonging to this ticket as test lot
        ttl = [l for l in d["lots"] if l["ticket_type_id"] == S["ticket_type_id"] and l.get("is_active")]
        assert ttl, "expected lots for default ticket"
        S["lot_id"] = ttl[0]["lot_id"]
        S["lot_price"] = ttl[0]["price"]
        # current_lots map keyed by ticket_type_id
        assert S["ticket_type_id"] in d["current_lots"]


# ---------- LOTS CRUD ----------
class TestLots:
    def test_create_list_update_delete(self):
        tok = S["admin_token"]
        payload = {
            "ticket_type_id": S["ticket_type_id"],
            "name": "TEST_lot",
            "price": 123.45,
            "quantity": 5,
            "order": 99,
            "is_active": True,
        }
        r = requests.post(f"{API}/admin/lots", json=payload, headers=_auth(tok))
        assert r.status_code == 200, r.text
        lot = r.json()
        assert lot["name"] == "TEST_lot"
        assert lot["price"] == 123.45
        S["temp_lot_id"] = lot["lot_id"]

        r = requests.get(f"{API}/admin/lots", headers=_auth(tok))
        assert r.status_code == 200
        lots = r.json()
        found = [l for l in lots if l["lot_id"] == S["temp_lot_id"]]
        assert found and "sold_qty" in found[0] and "remaining" in found[0]
        assert found[0]["remaining"] == 5

        r = requests.put(f"{API}/admin/lots/{S['temp_lot_id']}", json={"price": 200.0}, headers=_auth(tok))
        assert r.status_code == 200

        r = requests.delete(f"{API}/admin/lots/{S['temp_lot_id']}", headers=_auth(tok))
        assert r.status_code == 200

    def test_lots_rbac(self):
        r = requests.get(f"{API}/admin/lots")
        assert r.status_code in (401, 403)


# ---------- COUPONS ----------
class TestCoupons:
    def test_create_duplicate_validate(self):
        tok = S["admin_token"]
        suffix = secrets.token_hex(3).upper()
        code = f"TEST{suffix}"
        r = requests.post(f"{API}/admin/coupons", json={
            "code": code.lower(), "discount_type": "percent", "discount_value": 10, "is_active": True
        }, headers=_auth(tok))
        assert r.status_code == 200, r.text
        cup = r.json()
        assert cup["code"] == code  # uppercased
        S["coupon_code"] = code
        S["coupon_id"] = cup["coupon_id"]

        # duplicate
        r = requests.post(f"{API}/admin/coupons", json={
            "code": code, "discount_type": "percent", "discount_value": 5
        }, headers=_auth(tok))
        assert r.status_code == 400

        # validate
        r = requests.get(f"{API}/coupons/validate/{code}")
        assert r.status_code == 200
        assert r.json()["code"] == code

        # invalid
        r = requests.get(f"{API}/coupons/validate/NOPE_{suffix}")
        assert r.status_code == 404

    def test_fixed_coupon_and_exhaust(self):
        tok = S["admin_token"]
        code = f"TESTF{secrets.token_hex(3).upper()}"
        r = requests.post(f"{API}/admin/coupons", json={
            "code": code, "discount_type": "fixed", "discount_value": 50, "max_uses": 1, "is_active": True
        }, headers=_auth(tok))
        assert r.status_code == 200
        S["fixed_coupon"] = code

    def test_coupons_rbac(self):
        r = requests.get(f"{API}/admin/coupons")
        assert r.status_code in (401, 403)


# ---------- ORDER w/ lot + coupon + UTM ----------
class TestOrdersV2:
    def test_order_requires_lot_picks_default(self):
        # don't pass lot_id → backend should fallback to first active
        payload = {
            "ticket_type_id": S["ticket_type_id"],
            "holder_name": "TEST V2 Holder",
            "holder_email": f"test_v2_{secrets.token_hex(3)}@example.com",
            "payment_method": "pix",
        }
        r = requests.post(f"{API}/orders", json=payload)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["lot_id"]  # auto-picked
        S["order_lot_id_only"] = o["order_id"]

    def test_order_with_percent_coupon_and_utm(self):
        payload = {
            "ticket_type_id": S["ticket_type_id"],
            "lot_id": S["lot_id"],
            "holder_name": "TEST Coupon Holder",
            "holder_email": f"test_coup_{secrets.token_hex(3)}@example.com",
            "payment_method": "pix",
            "coupon_code": S["coupon_code"],
            "utm": {"utm_source": "google", "utm_medium": "cpc", "utm_campaign": "launch"},
        }
        r = requests.post(f"{API}/orders", json=payload)
        assert r.status_code == 200, r.text
        o = r.json()
        expected_subtotal = S["lot_price"]
        expected_discount = round(expected_subtotal * 0.10, 2)
        assert abs(o["subtotal"] - expected_subtotal) < 0.01
        assert abs(o["discount"] - expected_discount) < 0.01
        assert abs(o["total_amount"] - (expected_subtotal - expected_discount)) < 0.01
        assert o["coupon_code"] == S["coupon_code"]
        assert o["utm"]["utm_source"] == "google"

    def test_order_fixed_coupon(self):
        payload = {
            "ticket_type_id": S["ticket_type_id"],
            "lot_id": S["lot_id"],
            "holder_name": "TEST Fixed",
            "holder_email": f"test_fix_{secrets.token_hex(3)}@example.com",
            "payment_method": "pix",
            "coupon_code": S["fixed_coupon"],
        }
        r = requests.post(f"{API}/orders", json=payload)
        assert r.status_code == 200
        o = r.json()
        assert o["discount"] == 50

    def test_lot_overselling_blocked(self):
        tok = S["admin_token"]
        # Create a tiny lot with quantity 1, then attempt 2 orders
        r = requests.post(f"{API}/admin/lots", json={
            "ticket_type_id": S["ticket_type_id"],
            "name": "TEST_tiny", "price": 1.0, "quantity": 1, "order": 88, "is_active": True
        }, headers=_auth(tok))
        assert r.status_code == 200
        tiny = r.json()["lot_id"]

        ok = requests.post(f"{API}/orders", json={
            "ticket_type_id": S["ticket_type_id"], "lot_id": tiny,
            "holder_name": "TEST Tiny1", "holder_email": f"tiny1_{secrets.token_hex(3)}@example.com",
            "payment_method": "pix",
        })
        assert ok.status_code == 200
        bad = requests.post(f"{API}/orders", json={
            "ticket_type_id": S["ticket_type_id"], "lot_id": tiny,
            "holder_name": "TEST Tiny2", "holder_email": f"tiny2_{secrets.token_hex(3)}@example.com",
            "payment_method": "pix",
        })
        assert bad.status_code == 400
        # cleanup
        requests.delete(f"{API}/admin/lots/{tiny}", headers=_auth(tok))


# ---------- LEADERS + goal auto-courtesy ----------
class TestLeaders:
    def test_create_leader_promotes_user_and_goal_flow(self):
        tok = S["admin_token"]
        # create a user via admin
        uemail = f"test_leader_{secrets.token_hex(3)}@example.com"
        r = requests.post(f"{API}/admin/users", json={
            "name": "TEST Leader", "email": uemail, "password": "Passw0rd!", "role": "participante"
        }, headers=_auth(tok))
        assert r.status_code == 200, r.text
        u = r.json()
        S["leader_user_id"] = u["user_id"]
        S["leader_user_email"] = uemail

        # promote → target_sales=2
        r = requests.post(f"{API}/admin/leaders", json={
            "user_id": u["user_id"], "target_sales": 2
        }, headers=_auth(tok))
        assert r.status_code == 200, r.text
        ldr = r.json()
        S["leader_slug"] = ldr["slug"]
        S["leader_id"] = ldr["leader_id"]

        # user role bumped to lider
        r = requests.get(f"{API}/admin/users", headers=_auth(tok))
        assert r.status_code == 200
        promoted = next((x for x in r.json() if x["user_id"] == u["user_id"]), None)
        assert promoted and promoted["role"] == "lider"

        # list leaders → has stats
        r = requests.get(f"{API}/admin/leaders", headers=_auth(tok))
        assert r.status_code == 200
        lst = r.json()
        ours = next(x for x in lst if x["leader_id"] == ldr["leader_id"])
        for k in ("sales_count", "tickets_sold", "revenue", "progress_pct", "goal_reached"):
            assert k in ours

        # public leader info
        r = requests.get(f"{API}/public/leader/{S['leader_slug']}")
        assert r.status_code == 200
        assert r.json()["slug"] == S["leader_slug"]

        # Create 2 orders attributed to leader and simulate-pay → triggers courtesy
        for i in range(2):
            o = requests.post(f"{API}/orders", json={
                "ticket_type_id": S["ticket_type_id"], "lot_id": S["lot_id"],
                "holder_name": f"TEST Ld Buyer {i}",
                "holder_email": f"ld_buyer_{i}_{secrets.token_hex(3)}@example.com",
                "payment_method": "pix",
                "utm": {"leader_slug": S["leader_slug"]},
            })
            assert o.status_code == 200, o.text
            data = o.json()
            assert data["leader_id"] == ldr["leader_id"]
            sp = requests.post(f"{API}/orders/{data['order_id']}/simulate-pay")
            assert sp.status_code == 200

        # Wait briefly then verify courtesy_credential_issued and a COURTESY order exists for leader's user
        time.sleep(1.5)
        r = requests.get(f"{API}/admin/leaders", headers=_auth(tok))
        ours = next(x for x in r.json() if x["leader_id"] == ldr["leader_id"])
        assert ours["goal_reached"] is True
        assert ours.get("courtesy_credential_issued") is True or ours.get("tickets_sold", 0) >= 2

        # Find a courtesy order for the leader user
        r = requests.get(f"{API}/admin/orders", headers=_auth(tok))
        assert r.status_code == 200
        orders = r.json()
        leader_courtesy = [o for o in orders if o.get("user_id") == S["leader_user_id"] and o.get("status") == "COURTESY"]
        assert leader_courtesy, "Expected a courtesy order auto-issued for leader"

    def test_leaders_rbac(self):
        r = requests.get(f"{API}/admin/leaders")
        assert r.status_code in (401, 403)


# ---------- ORDER ADMIN ACTIONS ----------
class TestOrdersAdminActions:
    def test_change_status_resend_pdf_courtesy(self):
        tok = S["admin_token"]
        # Create an order to act on
        r = requests.post(f"{API}/orders", json={
            "ticket_type_id": S["ticket_type_id"], "lot_id": S["lot_id"],
            "holder_name": "TEST Status",
            "holder_email": f"test_status_{secrets.token_hex(3)}@example.com",
            "payment_method": "pix",
        })
        assert r.status_code == 200
        order_id = r.json()["order_id"]

        # Move to PAID via admin status endpoint
        r = requests.put(f"{API}/admin/orders-actions/{order_id}/status",
                         json={"status": "PAID", "notes": "manual"}, headers=_auth(tok))
        assert r.status_code == 200

        # Should have credentials generated
        r = requests.get(f"{API}/orders/{order_id}", headers=_auth(tok))
        assert r.status_code == 200
        ord_data = r.json()
        assert ord_data["status"] == "PAID"
        assert ord_data.get("credentials") and len(ord_data["credentials"]) >= 1
        cred = ord_data["credentials"][0]
        S["pdf_order_id"] = order_id
        S["pdf_cred_code"] = cred["credential_code"]

        # Resend email (Resend not configured → sent=0)
        r = requests.post(f"{API}/admin/orders-actions/{order_id}/resend-email", headers=_auth(tok))
        assert r.status_code == 200
        body = r.json()
        assert "sent" in body and "total" in body

        # PDF
        r = requests.get(f"{API}/admin/orders-actions/{order_id}/credential-pdf/{cred['credential_code']}", headers=_auth(tok))
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 500
        assert r.content[:4] == b"%PDF"

    def test_manual_courtesy(self):
        tok = S["admin_token"]
        r = requests.post(f"{API}/admin/orders-actions/manual-courtesy", json={
            "holder_name": "TEST Courtesy",
            "holder_email": f"test_court_{secrets.token_hex(3)}@example.com",
            "ticket_type_id": S["ticket_type_id"],
            "notes": "VIP guest",
        }, headers=_auth(tok))
        assert r.status_code == 200
        order_id = r.json()["order_id"]
        # verify
        r = requests.get(f"{API}/orders/{order_id}", headers=_auth(tok))
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "COURTESY"
        assert d["total_amount"] == 0
        assert d.get("credentials") and len(d["credentials"]) >= 1

    def test_admin_action_rbac(self):
        r = requests.put(f"{API}/admin/orders-actions/anything/status", json={"status": "PAID"})
        assert r.status_code in (401, 403)


# ---------- PASSWORD RESET ----------
class TestPasswordReset:
    def test_forgot_and_reset_flow(self):
        # Create a target user
        tok = S["admin_token"]
        email = f"test_pwreset_{secrets.token_hex(3)}@example.com"
        r = requests.post(f"{API}/admin/users", json={
            "name": "TEST PW", "email": email, "password": "OldPass1!", "role": "participante"
        }, headers=_auth(tok))
        assert r.status_code == 200

        # forgot
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        assert r.status_code == 200
        # also non-existent email returns 200 (no enum leak)
        r2 = requests.post(f"{API}/auth/forgot-password", json={"email": "nobody_xx_yy@example.com"})
        assert r2.status_code == 200

        # fetch token directly from DB via a side channel: we use email_logs is not enough; use direct DB connection
        import motor.motor_asyncio, asyncio
        async def _get_token():
            cli = motor.motor_asyncio.AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = cli[os.environ.get("DB_NAME", "ozoxx_database")]
            user = await db.users.find_one({"email": email.lower()})
            rec = await db.password_resets.find_one({"user_id": user["user_id"], "used": False}, sort=[("created_at", -1)])
            cli.close()
            return rec["token"]
        token = asyncio.run(_get_token())
        assert token

        # invalid token
        r = requests.post(f"{API}/auth/reset-password", json={"token": "bogus_token", "password": "NewPass1!"})
        assert r.status_code == 400

        # valid
        r = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": "NewPass1!"})
        assert r.status_code == 200

        # login with new
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "NewPass1!"})
        assert r.status_code == 200

        # token re-use should fail
        r = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": "Another1!"})
        assert r.status_code == 400


# ---------- EMAILS templates + send ----------
class TestEmails:
    def test_seeded_templates_and_crud(self):
        tok = S["admin_token"]
        r = requests.get(f"{API}/admin/emails/templates", headers=_auth(tok))
        assert r.status_code == 200, r.text
        tpls = r.json()
        assert isinstance(tpls, list) and len(tpls) >= 4

        # create
        r = requests.post(f"{API}/admin/emails/templates", json={
            "name": "TEST_template", "subject": "Hi {{name}}", "html": "<p>Hello {{name}}</p>"
        }, headers=_auth(tok))
        assert r.status_code == 200
        tpl_id = r.json()["template_id"]

        # update
        r = requests.put(f"{API}/admin/emails/templates/{tpl_id}", json={
            "name": "TEST_template_2", "subject": "Hi2", "html": "<p>2</p>"
        }, headers=_auth(tok))
        assert r.status_code == 200

        # delete
        r = requests.delete(f"{API}/admin/emails/templates/{tpl_id}", headers=_auth(tok))
        assert r.status_code == 200

    def test_logs_endpoint(self):
        tok = S["admin_token"]
        r = requests.get(f"{API}/admin/emails/logs", headers=_auth(tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_send_custom_no_crash(self):
        tok = S["admin_token"]
        r = requests.post(f"{API}/admin/emails/send", json={
            "subject": "TEST subject", "html": "<p>Hi {{name}}</p>", "recipients": "all"
        }, headers=_auth(tok))
        assert r.status_code == 200
        d = r.json()
        for k in ("sent", "failed", "total"):
            assert k in d

    def test_emails_rbac(self):
        r = requests.get(f"{API}/admin/emails/templates")
        assert r.status_code in (401, 403)


# ---------- TRACKING + ANALYTICS ----------
class TestAnalytics:
    def test_pageview_and_funnel(self):
        # post a couple of pageviews
        for p in ["/", "/checkout", "/checkout"]:
            r = requests.post(f"{API}/tracking/pageview", json={
                "path": p, "utm_source": "google", "utm_medium": "cpc", "utm_campaign": "launch"
            })
            assert r.status_code == 200

        tok = S["admin_token"]
        r = requests.get(f"{API}/admin/analytics/funnel", headers=_auth(tok))
        assert r.status_code == 200
        d = r.json()
        for k in ("visits", "checkout_views", "orders", "paid"):
            assert k in d

    def test_other_analytics(self):
        tok = S["admin_token"]
        for ep in ("/admin/analytics/utm-sources", "/admin/analytics/daily-visits",
                   "/admin/analytics/abandoned-carts", "/admin/analytics/payment-methods",
                   "/admin/analytics/customer-profile", "/admin/analytics/sales-summary"):
            r = requests.get(f"{API}{ep}", headers=_auth(tok))
            assert r.status_code == 200, f"{ep} -> {r.status_code} {r.text[:200]}"


# ---------- UPLOADS ----------
class TestUploads:
    def test_upload_get_list_delete(self):
        tok = S["admin_token"]
        # 1x1 png
        png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082")
        files = {"file": ("pixel.png", png, "image/png")}
        r = requests.post(f"{API}/uploads", files=files, headers=_auth(tok))
        if r.status_code == 502:
            pytest.skip(f"storage not available: {r.text}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["file_id"] and d["url"]
        S["upload_file_id"] = d["file_id"]

        r = requests.get(f"{API}/uploads/files/{d['file_id']}")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) >= len(png)

        r = requests.get(f"{API}/uploads", headers=_auth(tok))
        assert r.status_code == 200
        assert any(x["file_id"] == d["file_id"] for x in r.json())

        r = requests.delete(f"{API}/uploads/{d['file_id']}", headers=_auth(tok))
        assert r.status_code == 200

    def test_upload_rbac(self):
        r = requests.post(f"{API}/uploads")
        assert r.status_code in (401, 403)


# ---------- Backward compatibility: a quick smoke from iteration_1 ----------
class TestBackwardCompat:
    def test_me_with_token(self):
        r = requests.get(f"{API}/auth/me", headers=_auth(S["admin_token"]))
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_admin_stats(self):
        r = requests.get(f"{API}/admin/stats", headers=_auth(S["admin_token"]))
        assert r.status_code == 200
