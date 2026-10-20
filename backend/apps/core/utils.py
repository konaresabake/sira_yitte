import io
import re
from urllib.parse import quote

from django.core.files.base import ContentFile
from django.utils.text import slugify


def unique_slug(instance, value, field="slug"):
    """Slug unique pour le modèle de `instance` (suffixe -2, -3... si nécessaire)."""
    base = slugify(value) or "item"
    slug, n = base, 2
    qs = instance.__class__._default_manager.exclude(pk=instance.pk)
    while qs.filter(**{field: slug}).exists():
        slug = f"{base}-{n}"
        n += 1
    return slug


def normalize_phone(raw):
    """Garde les chiffres et retire l'indicatif sénégalais (221) : '+221 77 585 73 58' -> '775857358'."""
    digits = re.sub(r"\D", "", str(raw or ""))
    if digits.startswith("00221"):
        digits = digits[5:]
    elif digits.startswith("221") and len(digits) > 9:
        digits = digits[3:]
    return digits


def whatsapp_url(number, text=""):
    url = f"https://wa.me/{number}"
    return f"{url}?text={quote(text)}" if text else url


def optimize_image(uploaded, max_side=1600, quality=82):
    """Redimensionne et convertit en WebP (performance : cahier des charges, section 25)."""
    from PIL import Image

    img = Image.open(uploaded)
    img = img.convert("RGBA" if img.mode in ("RGBA", "LA", "P") else "RGB")
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=quality, method=4)
    base = (getattr(uploaded, "name", "image") or "image").rsplit(".", 1)[0][:60]
    return ContentFile(buf.getvalue(), name=f"{slugify(base) or 'image'}.webp")
