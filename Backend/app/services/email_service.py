import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING, Optional

from app.core.config import settings
from app.core.security import decrypt_smtp_password

if TYPE_CHECKING:
    from app.models.smtp_configuration import SmtpConfiguration

logger = logging.getLogger("app.services.email")


def send_principal_invitation_email(
    principal_name: str,
    principal_email: str,
    raw_token: str,
    smtp_config: Optional["SmtpConfiguration"] = None,
) -> bool:
    """
    Send an onboarding invitation email to the newly created Principal
    using the authenticated Super Admin's dynamic SMTP configuration.
    Contains the single-use setup link where they will configure the school
    and create their own Password & PIN.
    """
    onboarding_url = f"{settings.FRONTEND_URL}/principal/setup-school?token={raw_token}"

    subject = "Welcome to School LMS — Complete Your School Setup"

    text_content = f"""
Dear {principal_name},

Welcome to School LMS Platform!

A Principal account has been created for you. To activate your school and access the system, please complete the school setup wizard:

{onboarding_url}

During this onboarding process, you will:
1. Provide your School details & address
2. Configure Classes, Sections, and Houses
3. Create your secure Password (for General Login)
4. Create your secure PIN (for Quick Login)

Note: This invitation link is secure, single-use, and valid for {settings.ONBOARDING_TOKEN_EXPIRE_HOURS} hours.

If you have any questions, please contact the platform administration.

Best regards,
{smtp_config.from_name if smtp_config else "School LMS Platform Team"}
"""

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
    .header {{ background: #0f172a; color: #ffffff; padding: 32px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }}
    .content {{ padding: 32px; line-height: 1.6; font-size: 15px; }}
    .button-container {{ text-align: center; margin: 32px 0; }}
    .btn {{ background-color: #2563eb; color: #ffffff !important; padding: 14px 28px; font-weight: 600; text-decoration: none; border-radius: 10px; display: inline-block; font-size: 15px; }}
    .steps-box {{ background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0; }}
    .steps-box h3 {{ margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }}
    .steps-box ul {{ margin: 0; padding-left: 20px; color: #334155; }}
    .footer {{ padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; background: #fafafa; }}
    .link-fallback {{ word-break: break-all; color: #64748b; font-size: 13px; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>School LMS Platform</h1>
    </div>
    <div class="content">
      <p>Dear <strong>{principal_name}</strong>,</p>
      <p>A Principal account has been created for you on the School LMS platform. To get started and activate your school workspace, please complete the initial school setup.</p>
      
      <div class="steps-box">
        <h3>During setup, you will:</h3>
        <ul>
          <li>Provide school profile and address details</li>
          <li>Configure active Classes and Sections</li>
          <li>Set up school Houses</li>
          <li><strong>Create your Password</strong> (used for General Login)</li>
          <li><strong>Create your Quick Login PIN</strong> (used for Fast PIN Login)</li>
        </ul>
      </div>

      <div class="button-container">
        <a href="{onboarding_url}" class="btn" target="_blank">Start School Setup</a>
      </div>

      <p class="link-fallback">
        If the button above does not work, copy and paste this link into your browser:<br>
        <a href="{onboarding_url}">{onboarding_url}</a>
      </p>

      <p style="font-size: 13px; color: #64748b;">This secure setup link is valid for {settings.ONBOARDING_TOKEN_EXPIRE_HOURS} hours and can only be used once.</p>
    </div>
    <div class="footer">
      &copy; {smtp_config.from_name if smtp_config else "School LMS Platform"}. All rights reserved.
    </div>
  </div>
</body>
</html>
"""

    # If Super Admin has active SMTP configured, attempt dynamic SMTP transmission
    if smtp_config and smtp_config.is_active and smtp_config.smtp_host:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{smtp_config.from_name} <{smtp_config.from_email}>"
            msg["To"] = principal_email

            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            plain_pwd = decrypt_smtp_password(smtp_config.smtp_password_encrypted)
            security_mode = (smtp_config.security or "TLS").upper()

            if security_mode == "SSL":
                server = smtplib.SMTP_SSL(smtp_config.smtp_host, smtp_config.smtp_port, timeout=15)
                with server:
                    if smtp_config.smtp_username and plain_pwd:
                        server.login(smtp_config.smtp_username, plain_pwd)
                    server.send_message(msg)
            else:
                server = smtplib.SMTP(smtp_config.smtp_host, smtp_config.smtp_port, timeout=15)
                with server:
                    if security_mode == "TLS":
                        server.starttls()
                    if smtp_config.smtp_username and plain_pwd:
                        server.login(smtp_config.smtp_username, plain_pwd)
                    server.send_message(msg)

            logger.info(f"Successfully sent invitation email to {principal_email} using SMTP host {smtp_config.smtp_host}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via Super Admin SMTP: {e}. Falling back to console log.")

    # In development / fallback, log the setup URL cleanly
    print("\n" + "=" * 80)
    print(f"[EMAIL] Invitation to: {principal_email}")
    print(f"[EMAIL] Principal:     {principal_name}")
    print(f"[EMAIL] Setup URL:     {onboarding_url}")
    if smtp_config:
        print(f"[EMAIL] From:          {smtp_config.from_name} <{smtp_config.from_email}>")
        print(f"[EMAIL] Via SMTP Host: {smtp_config.smtp_host}:{smtp_config.smtp_port} ({smtp_config.security})")
    print("=" * 80 + "\n")
    logger.info(f"Generated onboarding link for {principal_email}: {onboarding_url}")
    return True
