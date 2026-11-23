from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.core.exceptions import BadRequestException

MAX_EMBLEM_BYTES = 5 * 1024 * 1024
MAX_EMBLEM_PIXELS = 4_194_304
FORMAT_BY_SUFFIX = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".webp": "WEBP"}
EMBLEM_DIRECTORY = Path("uploads") / "emblems"


def available_emblem_url(url: str | None) -> str | None:
    local_prefix = "/uploads/emblems/"
    if not url or not url.startswith(local_prefix):
        return url

    filename = url.removeprefix(local_prefix)
    if not filename or Path(filename).name != filename:
        return None
    return url if (EMBLEM_DIRECTORY / filename).is_file() else None


def _store_emblem(contents: bytes, suffix: str) -> str:
    try:
        with Image.open(BytesIO(contents), formats=list(set(FORMAT_BY_SUFFIX.values()))) as image:
            if (
                image.format != FORMAT_BY_SUFFIX[suffix] or image.width * image.height > MAX_EMBLEM_PIXELS
                or getattr(image, "is_animated", False)
            ):
                raise BadRequestException("Use a static PNG, JPEG or WebP emblem at most four megapixels.")
            oriented = ImageOps.exif_transpose(image)
            oriented.thumbnail((512, 512))
            pixels = oriented.convert("RGBA")
            clean = Image.new("RGBA", pixels.size)
            clean.paste(pixels)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise BadRequestException("The emblem is not a valid image.") from exc

    EMBLEM_DIRECTORY.mkdir(parents=True, exist_ok=True)
    filename = f"emblem_{uuid4().hex}.png"
    path = EMBLEM_DIRECTORY / filename
    destination = path.open("xb")
    try:
        with destination:
            clean.save(destination, format="PNG")
    except OSError:
        path.unlink(missing_ok=True)
        raise
    return filename


async def save_emblem(file: UploadFile) -> str:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in FORMAT_BY_SUFFIX:
        raise BadRequestException("Use a PNG, JPEG or WebP emblem.")
    contents = await file.read(MAX_EMBLEM_BYTES + 1)
    if not contents or len(contents) > MAX_EMBLEM_BYTES:
        raise BadRequestException("The emblem must be between 1 byte and 5 MB.")
    return await run_in_threadpool(_store_emblem, contents, suffix)
