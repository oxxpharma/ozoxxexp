"""Backend tests for enhanced leader dashboard + admin stats (iteration 5)."""
import os
import uuid
import requests
import pytest
from pymongo import MongoClient

BASE_URL = ""
with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break

MONGO_URL = ""
DB_NAME = ""
with open("/app/backend/.env") as f:
    for line in f:
        line = line.strip()
        if line.startswith("MONGO_URL="):
            MONGO_URL = line.split("=", 1)[1].strip().strip('"')
        elif line.startswith("DB_NAME="):
            DB_NAME = line.split("=", 1)[1].strip().strip('"')

ADMIN_EMAIL = "admin@ozoxx.com"
ADMIN_PASSWORD = "OzoxxAdmin@2025"

_mongo = MongoClient(MONGO_URL)
_dbs = _mongo[DB_NAME]


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_admin_stats_has_tickets_fields(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("tickets_sold", "tickets_pending", "tickets_paid_only", "tickets_courtesy"):
        assert k in data, f"Missing key {k}"
        assert isinstance(data[k], int)
    assert data["tickets_sold"] == data["tickets_paid_only"] + data["tickets_courtesy"]


def test_non_leader_gets_404(admin_headers):
    r = requests.get(f"{BASE_URL}/api/me/leader", headers=admin_headers)
    assert r.status_code == 404


@pytest.fixture(scope="module")
def leader_user(admin_headers):
    email = f"TEST_leader_{uuid.uuid4().hex[:8]}@ozoxx.com"
    password = "TestPass@123"
    r = requests.post(f"{BASE_URL}/api/admin/users",
                      json={"email": email, "name": "TEST Leader", "password": password, "role": "participante"},
                      headers=admin_headers)
    assert r.status_code == 200, r.text
    user = r.json()
    user["password"] = password
    r2 = requests.post(f"{BASE_URL}/api/admin/leaders",
                       json={"user_id": user["user_id"], "target_sales": 2},
                       headers=admin_headers)
    assert r2.status_code == 200, r2.text
    leader = r2.json()
    user["leader_id"] = leader["leader_id"]
    user["slug"] = leader["slug"]
    yield user
    try:
        requests.delete(f"{BASE_URL}/api/admin/leaders/{leader['leader_id']}", headers=admin_headers)
        requests.delete(f"{BASE_URL}/api/admin/users/{user['user_id']}", headers=admin_headers)
    except Exception:
        pass


@pytest.fixture(scope="module")
def leader_headers(leader_user):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": leader_user["email"], "password": leader_user["password"]})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_me_leader_empty_state(leader_headers):
    r = requests.get(f"{BASE_URL}/api/me/leader", headers=leader_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data.get("buyers"), list)
    assert data["buyers"] == []
    assert data["courtesy"] is None
    assert data["tickets_sold"] == 0
    assert data["goal_reached"] is False
    # No _id leak
    assert "_id" not in data


def test_me_leader_buyers_populated(leader_user, leader_headers):
    order_id = f"ord_TEST_{uuid.uuid4().hex[:10]}"
    _dbs.orders.insert_one({
        "order_id": order_id, "user_id": "guest",
        "leader_id": leader_user["leader_id"],
        "holder_name": "TEST Buyer", "holder_email": "buyer@x.com",
        "quantity": 1, "total_amount": 690.0, "status": "PAID",
        "payment_method": "PIX", "ticket_type_name": "Passaporte Ozoxx",
        "lot_name": "1º Lote", "created_at": "2025-01-15T12:00:00",
    })
    try:
        r = requests.get(f"{BASE_URL}/api/me/leader", headers=leader_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["tickets_sold"] >= 1
        ours = [b for b in data["buyers"] if b["order_id"] == order_id]
        assert len(ours) == 1
        b = ours[0]
        assert b["holder_name"] == "TEST Buyer"
        assert b["quantity"] == 1
        assert b["status"] == "PAID"
        assert b["ticket_type_name"] == "Passaporte Ozoxx"
        assert b["lot_name"] == "1º Lote"
        assert "_id" not in b
    finally:
        _dbs.orders.delete_one({"order_id": order_id})


def test_me_leader_courtesy_when_goal_reached(leader_user, leader_headers):
    paid1 = f"ord_TEST_{uuid.uuid4().hex[:10]}"
    paid2 = f"ord_TEST_{uuid.uuid4().hex[:10]}"
    court = f"ord_TEST_{uuid.uuid4().hex[:10]}"
    cred = f"CRED-TEST-{uuid.uuid4().hex[:6].upper()}"
    _dbs.orders.insert_many([
        {"order_id": paid1, "user_id": "guest", "leader_id": leader_user["leader_id"],
         "holder_name": "A", "holder_email": "a@x.com", "quantity": 1, "total_amount": 690.0,
         "status": "PAID", "payment_method": "PIX",
         "ticket_type_name": "Passaporte Ozoxx", "lot_name": "1º Lote",
         "created_at": "2025-01-15T12:00:00"},
        {"order_id": paid2, "user_id": "guest", "leader_id": leader_user["leader_id"],
         "holder_name": "B", "holder_email": "b@x.com", "quantity": 1, "total_amount": 690.0,
         "status": "PAID", "payment_method": "PIX",
         "ticket_type_name": "Passaporte Ozoxx", "lot_name": "1º Lote",
         "created_at": "2025-01-15T13:00:00"},
        {"order_id": court, "user_id": leader_user["user_id"],
         "holder_name": "TEST Leader", "holder_email": leader_user["email"],
         "quantity": 1, "total_amount": 0.0, "status": "COURTESY",
         "payment_method": "COURTESY", "courtesy_reason": "Líder atingiu meta",
         "ticket_type_name": "Passaporte Ozoxx", "lot_name": "1º Lote",
         "created_at": "2025-01-15T14:00:00"},
    ])
    _dbs.credentials.insert_one({
        "credential_code": cred, "order_id": court,
        "user_id": leader_user["user_id"], "checked_in": False,
        "holder_name": "TEST Leader",
    })
    _dbs.leaders.update_one({"leader_id": leader_user["leader_id"]},
                            {"$set": {"courtesy_credential_issued": True}})
    try:
        r = requests.get(f"{BASE_URL}/api/me/leader", headers=leader_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["tickets_sold"] >= 2
        assert data["goal_reached"] is True
        assert data["courtesy"] is not None, f"courtesy missing, got: {data.get('courtesy')}"
        assert data["courtesy"]["order"]["order_id"] == court
        assert data["courtesy"]["credential"]["credential_code"] == cred
        assert "_id" not in data["courtesy"]["order"]
        assert "_id" not in data["courtesy"]["credential"]
        buyer_ids = {b["order_id"] for b in data["buyers"]}
        assert paid1 in buyer_ids
        assert paid2 in buyer_ids
    finally:
        _dbs.orders.delete_many({"order_id": {"$in": [paid1, paid2, court]}})
        _dbs.credentials.delete_one({"credential_code": cred})
