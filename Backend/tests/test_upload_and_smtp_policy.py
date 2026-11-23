import asyncio
from io import BytesIO

import pytest
from cryptography.fernet import Fernet
from fastapi import UploadFile
from PIL import Image, PngImagePlugin
from pydantic import SecretStr

from app.core.config import settings
from app.core.exceptions import BadRequestException
from app.core.security import decrypt_smtp_password, encrypt_smtp_password, smtp_password_is_configured
from app.core.smtp_policy import validate_smtp_target
from app.services import emblem_service


def test_smtp_enforces_the_provider_and_encrypted_submission_mode():
    assert validate_smtp_target("SMTP.GMAIL.COM.", 587, "TLS") == "smtp.gmail.com"
    assert validate_smtp_target("smtp.gmail.com", 465, "SSL") == "smtp.gmail.com"
    for host, port, mode in (
        ("unknown.example", 587, "TLS"),
        ("smtp.gmail.com", 25, "NONE"),
        ("smtp.gmail.com", 465, "TLS"),
    ):
        with pytest.raises(BadRequestException):
            validate_smtp_target(host, port, mode)


def test_smtp_credentials_use_their_own_key(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_ENCRYPTION_KEY", SecretStr(Fernet.generate_key().decode("ascii")))
    secret = "synthetic password for verification"
    ciphertext = encrypt_smtp_password(secret)
    assert ciphertext.startswith("v1:")
    assert secret not in ciphertext

    monkeypatch.setattr(settings, "JWT_SECRET", "different-test-signing-key-for-verification")
    assert smtp_password_is_configured(ciphertext)
    assert decrypt_smtp_password(ciphertext) == secret

    assert not smtp_password_is_configured("legacy-ciphertext")
    with pytest.raises(BadRequestException):
        decrypt_smtp_password("legacy-ciphertext")


def test_emblem_is_resized_and_does_not_keep_metadata(tmp_path, monkeypatch):
    monkeypatch.setattr(emblem_service, "EMBLEM_DIRECTORY", tmp_path)
    contents = BytesIO()
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("comment", "synthetic metadata")
    Image.new("RGB", (640, 480), "blue").save(contents, format="PNG", pnginfo=metadata)
    contents.seek(0)
    filename = asyncio.run(emblem_service.save_emblem(UploadFile(contents, filename="logo.png")))
    with Image.open(tmp_path / filename) as saved:
        assert saved.format == "PNG"
        assert saved.size == (512, 384)
        assert "comment" not in saved.info
    url = f"/uploads/emblems/{filename}"
    assert emblem_service.available_emblem_url(url) == url
    assert emblem_service.available_emblem_url("/uploads/emblems/missing.png") is None


def test_emblem_rejects_bytes_without_image_content(tmp_path, monkeypatch):
    monkeypatch.setattr(emblem_service, "EMBLEM_DIRECTORY", tmp_path)
    invalid = UploadFile(BytesIO(b"synthetic invalid image"), filename="logo.png")
    with pytest.raises(BadRequestException):
        asyncio.run(emblem_service.save_emblem(invalid))
    assert list(tmp_path.iterdir()) == []
