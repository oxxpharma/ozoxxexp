import asyncio
import base64
import logging
from typing import Optional, List

import resend

from db import db

logger = logging.getLogger(__name__)


async def _get_resend_config():
    settings = await db.app_settings.find_one({"_id": "integrations"})
    if not settings:
        return None, None
    return settings.get("resend_api_key"), settings.get("resend_sender") or "onboarding@resend.dev"


def render_template(html: str, ctx: dict) -> str:
    out = html
    for k, v in ctx.items():
        out = out.replace(f"{{{{{k}}}}}", str(v if v is not None else ""))
    return out


async def log_email(*, to: str, subject: str, status: str, result_id: str = None, error: str = None, template_id: str = None):
    from models import now_iso, gen_id
    await db.email_logs.insert_one({
        "log_id": gen_id("elog"),
        "to": to,
        "subject": subject,
        "status": status,
        "result_id": result_id,
        "error": error,
        "template_id": template_id,
        "created_at": now_iso(),
    })


async def send_html_email(to_email: str, subject: str, html: str, *, attachments: Optional[List[dict]] = None, template_id: str = None) -> dict:
    api_key, sender = await _get_resend_config()
    if not api_key:
        await log_email(to=to_email, subject=subject, status="skipped", error="resend_not_configured", template_id=template_id)
        return {"sent": False, "reason": "resend_not_configured"}

    resend.api_key = api_key
    params = {
        "from": sender,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    if attachments:
        params["attachments"] = attachments

    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        await log_email(to=to_email, subject=subject, status="sent", result_id=result.get("id"), template_id=template_id)
        return {"sent": True, "id": result.get("id")}
    except Exception as e:
        logger.exception("Failed to send email")
        await log_email(to=to_email, subject=subject, status="failed", error=str(e)[:300], template_id=template_id)
        return {"sent": False, "reason": str(e)}


async def send_credential_email(*, to_email: str, to_name: str, event_name: str, qr_png_b64: str, credential_code: str, ticket_type_name: str, pdf_bytes: bytes = None) -> dict:
    qr_raw = qr_png_b64.split(",")[-1]
    html = f"""
    <div style="font-family:Arial,sans-serif;background:#070b1e;padding:40px;color:#fff">
      <table width="600" align="center" style="background:#101638;border-radius:16px;padding:32px;color:#fff">
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
          <p style="margin-top:24px;color:#a0a8c0">Apresente este QR Code na entrada do evento. Você também pode baixar o PDF em anexo.</p>
        </td></tr>
      </table>
    </div>
    """
    attachments = [{"filename": "credencial.png", "content": qr_raw}]
    if pdf_bytes:
        attachments.append({
            "filename": f"credencial-{credential_code}.pdf",
            "content": base64.b64encode(pdf_bytes).decode("ascii"),
        })
    return await send_html_email(to_email, f"Sua credencial — {event_name}", html, attachments=attachments, template_id="credential")
