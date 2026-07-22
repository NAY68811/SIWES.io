"""Emergent-managed Resend email service."""
import os
import logging
import httpx

logger = logging.getLogger("siwes.email")

# Constant — do NOT read from env; survives deployment.
EMAIL_BASE_URL = "https://integrations.emergentagent.com"


def _get_config() -> tuple[str, str] | None:
    key = os.environ.get("EMERGENT_EMAIL_KEY")
    name = os.environ.get("EMAIL_FROM_NAME")
    if not key or not name:
        return None
    return key, name


async def send_email(recipient: str, subject: str, html: str,
                     reply_to: str | None = None) -> bool:
    """Send an email via the Emergent proxy. Returns True on success."""
    config = _get_config()
    if not config:
        logger.warning("EMERGENT_EMAIL_KEY / EMAIL_FROM_NAME not set — skipping email to %s", recipient)
        return False
    key, from_name = config
    payload = {
        "to": [recipient],
        "subject": subject,
        "html": html,
        "from_name": from_name,
    }
    if reply_to:
        payload["contact_email"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": key}, json=payload)
        if resp.status_code >= 400:
            logger.error("email send %s -> %s: %s", recipient, resp.status_code, resp.text[:400])
            return False
        return True
    except Exception as e:
        logger.error("email send %s exception: %s", recipient, e)
        return False


def credentials_email_html(name: str, email: str, temp_password: str,
                           role: str, login_url: str) -> str:
    role_pretty = role.capitalize()
    return f"""
<!doctype html><html><body style="font-family: -apple-system, Segoe UI, Arial, sans-serif; background:#f4f6fb; margin:0; padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb;">
  <tr><td style="padding:24px 28px; background:#1f60ff; color:#ffffff;">
    <div style="font-weight:800; font-size:20px; letter-spacing:-0.02em;">SIWES.io</div>
    <div style="font-size:12px; opacity:.9; margin-top:2px;">Supervisor Allocation System</div>
  </td></tr>
  <tr><td style="padding:28px;">
    <h1 style="font-size:22px; margin:0 0 12px; color:#0f172a;">Welcome, {name}!</h1>
    <p style="color:#475569; line-height:1.55;">Your SIWES office has created a <strong>{role_pretty}</strong> account for you. Sign in with the temporary credentials below — you will be asked to set a new password on first login.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin:20px 0; border:1px solid #e5e7eb; border-radius:8px; padding:16px;">
      <tr><td style="color:#64748b; font-size:12px; padding-bottom:4px;">Email</td></tr>
      <tr><td style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace; padding-bottom:14px;">{email}</td></tr>
      <tr><td style="color:#64748b; font-size:12px; padding-bottom:4px;">Temporary password</td></tr>
      <tr><td style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">{temp_password}</td></tr>
    </table>
    <a href="{login_url}" style="display:inline-block; background:#1f60ff; color:#ffffff; text-decoration:none; font-weight:700; padding:12px 22px; border-radius:8px;">Sign in</a>
    <p style="color:#94a3b8; font-size:12px; margin-top:24px;">For security, do not share this password. If you did not expect this email, please ignore it.</p>
  </td></tr>
</table></body></html>
""".strip()
