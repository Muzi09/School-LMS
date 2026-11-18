import ipaddress
import smtplib
import socket
import ssl
from contextlib import contextmanager

from app.core.config import settings
from app.core.exceptions import BadRequestException

MODES_BY_PORT = {465: "SSL", 587: "TLS"}


def validate_smtp_target(host: str, port: int, security: str) -> str:
    normalized = host.strip().rstrip(".").lower()
    allowed = {value.strip().rstrip(".").lower() for value in settings.SMTP_ALLOWED_HOSTS.split(",")}
    if not normalized or normalized not in allowed or MODES_BY_PORT.get(port) != security.upper():
        raise BadRequestException("Use an approved SMTP provider with SSL on port 465 or STARTTLS on port 587.")
    return normalized


class _PublicSMTP(smtplib.SMTP):
    def _get_socket(self, host, port, timeout):
        addresses = list(dict.fromkeys(
            address[4][0] for address in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        ))
        if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
            raise OSError("SMTP provider must resolve only to public addresses.")

        last_error = None
        for address in addresses[:4]:
            try:
                return socket.create_connection((address, port), timeout, self.source_address)
            except OSError as exc:
                last_error = exc
        raise OSError("Could not connect to the SMTP provider.") from last_error


class _PublicSMTPSSL(smtplib.SMTP_SSL, _PublicSMTP):
    pass


@contextmanager
def smtp_connection(host: str, port: int, security: str, timeout: int):
    host = validate_smtp_target(host, port, security)
    context = ssl.create_default_context()
    if security.upper() == "SSL":
        with _PublicSMTPSSL(host, port, timeout=timeout, context=context) as connection:
            yield connection
    else:
        with _PublicSMTP(host, port, timeout=timeout) as connection:
            connection.ehlo()
            connection.starttls(context=context)
            connection.ehlo()
            yield connection
