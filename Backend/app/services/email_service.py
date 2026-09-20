import logging
import smtplib
import socket
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING, Optional, Tuple

from app.core.config import settings
from app.core.security import decrypt_smtp_password

if TYPE_CHECKING:
    from app.models.smtp_configuration import SmtpConfiguration

logger = logging.getLogger("app.services.email")


def test_smtp_connection(
    smtp_host: str,
    smtp_port: int,
    smtp_username: str,
    smtp_password: str,
    security: str = "TLS",
) -> Tuple[bool, Optional[str]]:
    """
    Test connectivity and authentication with the given SMTP credentials.
    Returns (True, None) on success or (False, error_message) on failure.
    """
    try:
        sec = (security or "TLS").upper()
        host_clean = smtp_host.strip()
        user_clean = smtp_username.strip().lower() if ("gmail" in host_clean.lower() or "google" in host_clean.lower()) else smtp_username.strip()
        pwd_clean = smtp_password.strip() if smtp_password else ""
        if "gmail" in host_clean.lower() or "google" in host_clean.lower():
            pwd_clean = pwd_clean.replace(" ", "")

        if sec == "SSL" or smtp_port == 465:
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(host_clean, smtp_port, timeout=12, context=context)
            with server:
                server.ehlo()
                if user_clean and pwd_clean:
                    server.login(user_clean, pwd_clean)
        else:
            server = smtplib.SMTP(host_clean, smtp_port, timeout=12)
            with server:
                server.ehlo()
                if sec == "TLS":
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                    server.ehlo()
                if user_clean and pwd_clean:
                    server.login(user_clean, pwd_clean)

        return True, None

    except smtplib.SMTPAuthenticationError as e:
        is_gmail = "gmail" in smtp_host.lower() or "google" in smtp_host.lower()
        if is_gmail:
            msg = (
                "1. Ensure you enter your logged in email App password.\n"
                "2. Gmail REQUIRES a 16-character Google App Password with spaces removed (not your normal login password)."
            )
        else:
            msg = f"SMTP Authentication Failed: Username or password rejected by {smtp_host} ({e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else e.smtp_error})"
        return False, msg

    except (socket.timeout, TimeoutError):
        return False, f"Connection to SMTP server {smtp_host}:{smtp_port} timed out after 12 seconds."

    except ssl.SSLError as e:
        return False, f"SSL/TLS negotiation failed with {smtp_host}:{smtp_port}. Please verify port and security mode (Port 465 for SSL, Port 587 for TLS): {e}"

    except Exception as e:
        return False, f"SMTP Connection Error ({smtp_host}:{smtp_port}): {str(e)}"


def send_principal_invitation_email(
    principal_name: str,
    principal_email: str,
    raw_token: str,
    smtp_config: Optional["SmtpConfiguration"] = None,
) -> bool:
    """
    Send an onboarding invitation email to the newly created Principal
    using the authenticated Admin's dynamic SMTP configuration.
    Raises Exception with detailed reason if sending fails.
    """
    if not smtp_config or not smtp_config.is_active or not smtp_config.smtp_host:
        raise ValueError("Active SMTP configuration is required to send principal invitation emails.")

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
{smtp_config.from_name}
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
      &copy; {smtp_config.from_name}. All rights reserved.
    </div>
  </div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{smtp_config.from_name} <{smtp_config.from_email}>"
    msg["To"] = principal_email

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    plain_pwd = decrypt_smtp_password(smtp_config.smtp_password_encrypted)
    security_mode = (smtp_config.security or "TLS").upper()
    host_clean = smtp_config.smtp_host.strip()
    user_clean = smtp_config.smtp_username.strip().lower() if ("gmail" in host_clean.lower() or "google" in host_clean.lower()) else smtp_config.smtp_username.strip()
    if "gmail" in host_clean.lower() or "google" in host_clean.lower() and plain_pwd:
        plain_pwd = plain_pwd.replace(" ", "")

    try:
        if security_mode == "SSL" or smtp_config.smtp_port == 465:
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(host_clean, smtp_config.smtp_port, timeout=15, context=context)
            with server:
                server.ehlo()
                if user_clean and plain_pwd:
                    server.login(user_clean, plain_pwd)
                server.send_message(msg)
        else:
            server = smtplib.SMTP(host_clean, smtp_config.smtp_port, timeout=15)
            with server:
                server.ehlo()
                if security_mode == "TLS":
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                    server.ehlo()
                if user_clean and plain_pwd:
                    server.login(user_clean, plain_pwd)
                server.send_message(msg)

        logger.info(f"Successfully sent invitation email to {principal_email} using SMTP host {smtp_config.smtp_host}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        is_gmail = "gmail" in host_clean.lower() or "google" in host_clean.lower()
        if is_gmail:
            err_msg = (
                "SMTP Authentication Failed: Gmail rejected the credentials.\n\n"
                "1. Make sure your 'SMTP Username' is your full Gmail address (e.g. user@gmail.com).\n"
                "2. Gmail requires a 16-character Google App Password (not your standard Google account password).\n"
                "Create one at https://myaccount.google.com/apppasswords"
            )
        else:
            err_msg = f"SMTP Authentication Failed: {e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else e.smtp_error}"
        logger.error(f"Email send error: {err_msg}")
        raise ValueError(err_msg)

    except smtplib.SMTPRecipientsRefused as e:
        err_msg = f"The SMTP server refused the recipient address '{principal_email}'."
        logger.error(f"Email send error: {err_msg}")
        raise ValueError(err_msg)

    except (socket.timeout, TimeoutError):
        err_msg = f"Connection to SMTP server {host_clean}:{smtp_config.smtp_port} timed out."
        logger.error(f"Email send error: {err_msg}")
        raise ValueError(err_msg)

    except ssl.SSLError as e:
        err_msg = f"SSL/TLS error connecting to {host_clean}:{smtp_config.smtp_port}: {e}"
        logger.error(f"Email send error: {err_msg}")
        raise ValueError(err_msg)

    except Exception as e:
        err_msg = f"Failed to send email via SMTP ({host_clean}:{smtp_config.smtp_port}): {str(e)}"
        logger.error(f"Email send error: {err_msg}")
        raise ValueError(err_msg)


def send_staff_invitation_email(
    staff_name: str,
    staff_email: str,
    school_name: str,
    raw_token: str,
    smtp_config: Optional["SmtpConfiguration"] = None,
) -> bool:
    """
    Send an account setup invitation email to the newly created Staff member
    using the Principal's configured outgoing email credentials.
    Raises Exception with actionable reason if sending fails.
    """
    if not smtp_config or not smtp_config.is_active or not smtp_config.smtp_host:
        raise ValueError("Active Email Setup is required to send staff invitation emails.")

    setup_url = f"{settings.FRONTEND_URL}/login/setup?token={raw_token}"
    display_school = school_name or "School LMS"
    subject = f"Set Up Your Staff Account — {display_school}"

    text_content = f"""
Hello {staff_name},

Your Staff account has been created for {display_school}.
Before you can log in, you need to complete your account setup.

Click the link below to create your password and Quick Login PIN:
{setup_url}

Note:
1. This setup link is secure, single-use, and valid for {settings.ONBOARDING_TOKEN_EXPIRE_HOURS} hours.
2. You will set your own Password and a 4-digit PIN for quick access.
3. If you did not expect this invitation, please contact your school administration.

Best regards,
{smtp_config.from_name or display_school}
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
    .header p {{ margin: 6px 0 0 0; color: #94a3b8; font-size: 14px; }}
    .content {{ padding: 32px; line-height: 1.6; font-size: 15px; }}
    .button-container {{ text-align: center; margin: 32px 0; }}
    .btn {{ background-color: #2563eb; color: #ffffff !important; padding: 14px 32px; font-weight: 600; text-decoration: none; border-radius: 10px; display: inline-block; font-size: 15px; }}
    .steps-box {{ background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0; }}
    .steps-box h3 {{ margin-top: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }}
    .steps-box ul {{ margin: 0; padding-left: 20px; color: #334155; }}
    .footer {{ padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; background: #fafafa; }}
    .link-fallback {{ word-break: break-all; color: #64748b; font-size: 13px; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{display_school}</h1>
      <p>Staff Account Activation</p>
    </div>
    <div class="content">
      <p>Hello <strong>{staff_name}</strong>,</p>
      <p>A Staff account has been created for you at <strong>{display_school}</strong>. Before you can log in, please complete your one-time account setup.</p>
      
      <div class="steps-box">
        <h3>During setup, you will:</h3>
        <ul>
          <li><strong>Create your Password</strong> (used for standard login)</li>
          <li><strong>Create your Quick Login PIN</strong> (4-digit numeric code for fast login)</li>
          <li>Activate your staff profile and gain access to your school portal</li>
        </ul>
      </div>

      <div class="button-container">
        <a href="{setup_url}" class="btn" target="_blank">Set Up My Account</a>
      </div>

      <p class="link-fallback">
        If the button above does not work, copy and paste this link into your browser:<br>
        <a href="{setup_url}">{setup_url}</a>
      </p>

      <p style="font-size: 13px; color: #64748b;">
        This secure setup link is valid for {settings.ONBOARDING_TOKEN_EXPIRE_HOURS} hours and can only be used once.<br>
        If you did not expect this email, please contact your school administrator.
      </p>
    </div>
    <div class="footer">
      &copy; {display_school}. Powered by School LMS. All rights reserved.
    </div>
  </div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{smtp_config.from_name or display_school} <{smtp_config.from_email}>"
    msg["To"] = staff_email

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    plain_pwd = decrypt_smtp_password(smtp_config.smtp_password_encrypted)
    security_mode = (smtp_config.security or "TLS").upper()
    host_clean = smtp_config.smtp_host.strip()
    user_clean = smtp_config.smtp_username.strip().lower() if ("gmail" in host_clean.lower() or "google" in host_clean.lower()) else smtp_config.smtp_username.strip()
    if ("gmail" in host_clean.lower() or "google" in host_clean.lower()) and plain_pwd:
        plain_pwd = plain_pwd.replace(" ", "")

    try:
        if security_mode == "SSL" or smtp_config.smtp_port == 465:
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(host_clean, smtp_config.smtp_port, timeout=15, context=context)
            with server:
                server.ehlo()
                if user_clean and plain_pwd:
                    server.login(user_clean, plain_pwd)
                server.send_message(msg)
        else:
            server = smtplib.SMTP(host_clean, smtp_config.smtp_port, timeout=15)
            with server:
                server.ehlo()
                if security_mode == "TLS":
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                    server.ehlo()
                if user_clean and plain_pwd:
                    server.login(user_clean, plain_pwd)
                server.send_message(msg)

        logger.info(f"Successfully sent staff invitation email to {staff_email} via SMTP host {smtp_config.smtp_host}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        is_gmail = "gmail" in host_clean.lower() or "google" in host_clean.lower()
        if is_gmail:
            err_msg = (
                "SMTP Authentication Failed: Gmail rejected the credentials.\n"
                "Please verify your Email Address and 16-character Google App Password in Email Setup."
            )
        else:
            err_msg = f"SMTP Authentication Failed: {e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else e.smtp_error}"
        logger.error(f"Staff email send error: {err_msg}")
        raise ValueError(err_msg)

    except smtplib.SMTPRecipientsRefused:
        err_msg = f"The email server refused the recipient address '{staff_email}'."
        logger.error(f"Staff email send error: {err_msg}")
        raise ValueError(err_msg)

    except (socket.timeout, TimeoutError):
        err_msg = f"Connection to email server {host_clean}:{smtp_config.smtp_port} timed out."
        logger.error(f"Staff email send error: {err_msg}")
        raise ValueError(err_msg)

    except ssl.SSLError as e:
        err_msg = f"SSL/TLS error connecting to email server {host_clean}:{smtp_config.smtp_port}: {e}"
        logger.error(f"Staff email send error: {err_msg}")
        raise ValueError(err_msg)

    except Exception as e:
        err_msg = f"Failed to send email via email server ({host_clean}:{smtp_config.smtp_port}): {str(e)}"
        logger.error(f"Staff email send error: {err_msg}")
        raise ValueError(err_msg)

