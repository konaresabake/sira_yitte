import os
import tempfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.catalog.models import Category, Color, Product
from apps.core.models import ShopSettings
from apps.core.storage import CloudinaryMediaStorage
from apps.orders.models import DeliveryZone

User = get_user_model()


class BootstrapTests(TestCase):
    def run_cmd(self, **env):
        with mock.patch.dict(os.environ, env, clear=False):
            call_command("bootstrap", no_migrate=True, verbosity=0)

    def test_creates_defaults_once_and_never_overwrites_edits(self):
        self.run_cmd(SHOP_WHATSAPP="221700000001", SHOP_EMAIL="boutique@sirayitte.sn")
        self.assertEqual((Category.objects.count(), Color.objects.count(), DeliveryZone.objects.count()), (5, 7, 4))
        shop = ShopSettings.load()
        self.assertEqual((shop.whatsapp_number, shop.email), ("221700000001", "boutique@sirayitte.sn"))
        DeliveryZone.objects.filter(name="Dakar").update(fee=3500)
        Category.objects.filter(name="Homme").update(is_active=False)
        ShopSettings.objects.update(whatsapp_number="221711111111")
        self.run_cmd(SHOP_WHATSAPP="221700000001")  # redéploiement
        self.assertEqual(DeliveryZone.objects.get(name="Dakar").fee, 3500)
        self.assertFalse(Category.objects.get(name="Homme").is_active)
        self.assertEqual(ShopSettings.load().whatsapp_number, "221711111111")
        self.assertEqual(DeliveryZone.objects.count(), 4)

    def test_superuser_from_environment(self):
        self.run_cmd(DJANGO_SUPERUSER_EMAIL="Admin@SiraYitte.sn", DJANGO_SUPERUSER_PASSWORD="Un-Mot-De-Passe-Solide")
        user = User.objects.get(email="admin@sirayitte.sn")
        self.assertTrue(user.is_staff and user.is_superuser)
        self.assertTrue(user.check_password("Un-Mot-De-Passe-Solide"))
        self.run_cmd(DJANGO_SUPERUSER_EMAIL="admin@sirayitte.sn", DJANGO_SUPERUSER_PASSWORD="Autre-Mot-De-Passe-123")
        self.assertTrue(User.objects.get(email="admin@sirayitte.sn").check_password("Un-Mot-De-Passe-Solide"))  # inchangé

    def test_weak_password_refused_and_missing_vars_ignored(self):
        self.run_cmd(DJANGO_SUPERUSER_EMAIL="a@b.sn", DJANGO_SUPERUSER_PASSWORD="court")
        self.assertFalse(User.objects.filter(email="a@b.sn").exists())
        for k in ("DJANGO_SUPERUSER_EMAIL", "DJANGO_SUPERUSER_PASSWORD"):
            os.environ.pop(k, None)
        self.run_cmd()
        self.assertEqual(User.objects.count(), 0)

    def test_demo_catalogue_loaded_only_once(self):
        with override_settings(MEDIA_ROOT=tempfile.mkdtemp()):
            self.run_cmd(LOAD_DEMO_DATA="true")
            self.assertEqual(Product.objects.count(), 10)
            Product.objects.filter(name="Sandale Femme Saly").delete()  # le vendeur supprime un produit
            self.run_cmd(LOAD_DEMO_DATA="true")
            self.assertEqual(Product.objects.count(), 9)  # pas de re-création au redéploiement


@override_settings()
class CloudinaryStorageTests(TestCase):
    def setUp(self):
        import cloudinary
        cloudinary.config(cloud_name="demo", api_key="1", api_secret="2")
        self.storage = CloudinaryMediaStorage()

    def test_unique_names_keep_folder_and_extension(self):
        a = self.storage.get_available_name("products/2026/10/photo.webp")
        b = self.storage.get_available_name("products/2026/10/photo.webp")
        self.assertNotEqual(a, b)
        self.assertRegex(a, r"^products/2026/10/photo_[0-9a-f]{8}\.webp$")
        self.assertLessEqual(len(self.storage.get_available_name("x" * 200 + ".webp", max_length=100)), 100)

    def test_save_uploads_without_extension_as_public_id(self):
        with mock.patch("cloudinary.uploader.upload") as up:
            name = self.storage.save("products/2026/10/photo.webp", ContentFile(b"data"))
        self.assertTrue(name.startswith("products/2026/10/photo_") and name.endswith(".webp"))
        args, kwargs = up.call_args
        self.assertEqual(kwargs["public_id"], name[: -len(".webp")])
        self.assertEqual(kwargs["resource_type"], "image")

    def test_url_is_https_cdn_url_with_extension(self):
        url = self.storage.url("products/2026/10/photo_ab12cd34.webp")
        self.assertTrue(url.startswith("https://res.cloudinary.com/demo/image/upload/"))
        self.assertTrue(url.endswith("products/2026/10/photo_ab12cd34.webp"))

    def test_delete_and_exists(self):
        with mock.patch("cloudinary.uploader.destroy") as de:
            self.storage.delete("products/2026/10/photo_ab12cd34.webp")
        self.assertEqual(de.call_args.args[0], "products/2026/10/photo_ab12cd34")
        self.assertFalse(self.storage.exists("anything"))
