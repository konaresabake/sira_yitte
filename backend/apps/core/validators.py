from django.conf import settings
from django.core.exceptions import ValidationError


def validate_image_size(file):
    limit = settings.MAX_IMAGE_UPLOAD_MB * 1024 * 1024
    if file.size > limit:
        raise ValidationError(f"L'image dépasse {settings.MAX_IMAGE_UPLOAD_MB} Mo.")
