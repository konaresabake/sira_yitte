"""Stockage des images sur Cloudinary.

Le disque d'un service Render est éphémère : tout fichier écrit dessus disparaît au redémarrage ou au
redéploiement. Quand la variable CLOUDINARY_URL est définie, les images téléversées (produits, catégories)
sont donc envoyées sur Cloudinary et servies depuis leur CDN. Sans CLOUDINARY_URL, Django garde le
disque local (développement).
"""
import os
import uuid

import cloudinary
import cloudinary.uploader
import cloudinary.utils
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class CloudinaryMediaStorage(Storage):
    def get_available_name(self, name, max_length=None):
        """Nom toujours unique (suffixe aléatoire) : deux images ne s'écrasent jamais."""
        root, ext = os.path.splitext(name.replace("\\", "/"))
        suffix = f"_{uuid.uuid4().hex[:8]}"
        if max_length:
            root = root[: max(1, max_length - len(ext) - len(suffix))]
        return f"{root}{suffix}{ext}"

    def _save(self, name, content):
        root, _ext = os.path.splitext(name)
        content.seek(0)
        cloudinary.uploader.upload(content, public_id=root, resource_type="image", overwrite=False)
        return name

    def url(self, name):
        root, ext = os.path.splitext(name)
        return cloudinary.utils.cloudinary_url(root, format=ext.lstrip("."), secure=True, resource_type="image")[0]

    def exists(self, name):
        return False  # les noms sont déjà uniques

    def delete(self, name):
        if name:
            cloudinary.uploader.destroy(os.path.splitext(name)[0], resource_type="image", invalidate=True)

    def size(self, name):
        return 0

    def _open(self, name, mode="rb"):
        raise NotImplementedError("Les images Cloudinary se lisent par leur URL, pas depuis le disque.")
