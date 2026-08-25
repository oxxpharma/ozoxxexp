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
