import asyncio
import base64
import logging
from typing import Optional

import resend

from db import db

logger = logging.getLogger(__name__)


async def _get_resend_config():
    settings = await db.app_settings.find_one({"_id": "integrations"})
    if not settings:
        return None, None
    return settings.get("resend_api_key"), settings.get("resend_sender") or "onboarding@resend.dev"


async def send_credential_email(to_email: str, to_name: str, event_name: str, qr_png_b64: str, credential_code: str, ticket_type_name: str) -> dict:
    api_key, sender = await _get_resend_config()
    if not api_key:
        logger.warning("Resend API key not configured; skipping email send")
        return {"sent": False, "reason": "resend_not_configured"}

    resend.api_key = api_key
    qr_raw = qr_png_b64.split(",")[-1]

    html = f"""
    <div style="font-family:Arial,sans-serif;background:#070711;padding:40px;color:#fff">
      <table width="600" align="center" style="background:#0f1530;border-radius:16px;padding:32px;color:#fff">
        <tr><td>
          <h1 style="margin:0 0 8px 0;color:#28b9fc">{event_name}</h1>
          <p style="color:#a0a8c0;margin:0 0 24px 0">Olá, {to_name}! Sua credencial está pronta.</p>
          <div style="background:#18245a;border-radius:12px;padding:24px;text-align:center">
            <p style="margin:0 0 8px 0;color:#28b9fc;font-size:12px;letter-spacing:2px;text-transform:uppercase">Credencial</p>
            <p style="margin:0;font-size:20px;font-weight:bold">{to_name}</p>
            <p style="margin:4px 0 16px 0;color:#a0a8c0">{ticket_type_name}</p>
            <img src="cid:qrcode" alt="QR Code" style="width:240px;height:240px;background:#fff;padding:8px;border-radius:8px" />
            <p style="margin:16px 0 0 0;color:#a0a8c0;font-size:12px">Código: {credential_code}</p>
          </div>
          <p style="margin-top:24px;color:#a0a8c0">Apresente este QR Code na entrada do evento.</p>
        </td></tr>
      </table>
    </div>
    """

    params = {
        "from": sender,
        "to": [to_email],
        "subject": f"Sua credencial — {event_name}",
        "html": html,
        "attachments": [
            {
                "filename": "credencial.png",
                "content": qr_raw,
            }
        ],
    }

    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"sent": True, "id": result.get("id")}
    except Exception as e:
        logger.exception("Failed to send credential email")
        return {"sent": False, "reason": str(e)}
