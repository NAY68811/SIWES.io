import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger("siwes.email")


def _get_config():
    email = os.environ.get("EMAIL_ADDRESS")
    password = os.environ.get("EMAIL_PASSWORD")

    if not email or not password:
        return None

    return email, password


async def send_email(recipient, subject, html, reply_to=None):
    config = _get_config()

    if not config:
        logger.warning("Email credentials not configured.")
        return False

    sender_email, sender_password = config

    try:
        message = MIMEMultipart()
        message["From"] = sender_email
        message["To"] = recipient
        message["Subject"] = subject

        if reply_to:
            message["Reply-To"] = reply_to

        message.attach(MIMEText(html, "html"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, recipient, message.as_string())
        server.quit()

        return True

    except Exception as e:
        logger.error(e)
        return False


def credentials_email_html(name, email, temp_password, role, login_url):
    role_pretty = role.capitalize()

    return f"""
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif">

<h2>SIWES Supervisor Allocation System</h2>

<p>Hello <b>{name}</b>,</p>

<p>Your <b>{role_pretty}</b> account has been created successfully.</p>

<p><b>Email:</b> {email}</p>

<p><b>Temporary Password:</b> {temp_password}</p>

<p>
<a href="{login_url}">
Login to your account
</a>
</p>

<p>Please change your password after logging in.</p>

</body>
</html>
"""