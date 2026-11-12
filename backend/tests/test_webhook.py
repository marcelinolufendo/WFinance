"""Testes para a rota /webhook."""
import json
import pytest
from tests.conftest import make_signature


class TestWebhookVerification:
    async def test_get_valid_token(self, client):
        resp = await client.get("/webhook", params={
            "hub.mode": "subscribe",
            "hub.verify_token": "test-verify-token",
            "hub.challenge": "abc123",
        })
        assert resp.status_code == 200
        assert resp.text == "abc123"  # devolve o challenge como inteiro

    async def test_get_wrong_token(self, client):
        resp = await client.get("/webhook", params={
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong-token",
            "hub.challenge": "abc123",
        })
        assert resp.status_code == 403

    async def test_get_wrong_mode(self, client):
        resp = await client.get("/webhook", params={
            "hub.mode": "unsubscribe",
            "hub.verify_token": "test-verify-token",
            "hub.challenge": "abc123",
        })
        assert resp.status_code == 403


class TestWebhookPost:
    def _payload(self, message_type="text", content="Olá"):
        msg: dict = {
            "from": "244900000001",
            "id": "wamid.test001",
            "type": message_type,
        }
        if message_type == "text":
            msg["text"] = {"body": content}
        elif message_type == "audio":
            msg["audio"] = {"id": "media123", "mime_type": "audio/ogg; codecs=opus", "voice": True}

        return {
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [msg],
                        "contacts": [{"wa_id": "244900000001", "profile": {"name": "Teste"}}],
                    }
                }]
            }]
        }

    async def test_post_valid_signature_returns_ok(self, client):
        body = json.dumps(self._payload()).encode()
        resp = await client.post(
            "/webhook",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": make_signature(body),
            },
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    async def test_post_invalid_signature_returns_403(self, client):
        body = json.dumps(self._payload()).encode()
        resp = await client.post(
            "/webhook",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": "sha256=invalida",
            },
        )
        assert resp.status_code == 403

    async def test_post_missing_signature_returns_403(self, client):
        body = json.dumps(self._payload()).encode()
        resp = await client.post("/webhook", content=body,
                                 headers={"Content-Type": "application/json"})
        assert resp.status_code == 403

    async def test_post_status_update_returns_ok(self, client):
        body = json.dumps({
            "entry": [{
                "changes": [{
                    "value": {
                        "statuses": [{"id": "wamid.test001", "status": "delivered"}]
                    }
                }]
            }]
        }).encode()
        resp = await client.post(
            "/webhook",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": make_signature(body),
            },
        )
        assert resp.status_code == 200
