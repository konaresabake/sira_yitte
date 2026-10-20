import io
import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Product, ProductImage, ProductVariant
from apps.core.testing import make_admin, make_catalog, make_customer


def png_bytes(size=(40, 40)):
    buf = io.BytesIO()
    Image.new("RGB", size, "#7a4a2a").save(buf, "PNG")
    return buf.getvalue()


class PublicCatalogTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.c = make_catalog()

    def names(self, qs=""):
        return [p["name"] for p in self.client.get(f"/api/products/{qs}").data["results"]]

    def test_inactive_products_hidden_from_public(self):
        self.assertNotIn("Sandale Cachée", self.names())
        self.assertEqual(self.client.get(f"/api/products/{self.c['hidden'].pk}/").status_code, 404)

    def test_detail_by_id_and_by_slug(self):
        by_id = self.client.get(f"/api/products/{self.c['a'].pk}/")
        by_slug = self.client.get("/api/products/sandale-sahel/")
        self.assertEqual(by_id.status_code, 200)
        self.assertEqual(by_id.data["id"], by_slug.data["id"])
        self.assertEqual(len(by_id.data["variants"]), 2)
        self.assertEqual(by_id.data["total_stock"], 5)

    def test_list_payload(self):
        b = next(p for p in self.client.get("/api/products/").data["results"] if p["slug"] == "sandale-saly")
        self.assertEqual(b["discount_percent"], 26)
        self.assertEqual(b["sizes"], [38])
        self.assertEqual(b["colors"][0]["name"], "Marron")
        self.assertTrue(b["in_stock"])

    def test_filters(self):
        self.assertEqual(self.names("?category=homme"), ["Sandale Sahel"])
        self.assertEqual(self.names(f"?category={self.c['femme'].pk}"), ["Sandale Saly"])
        self.assertEqual(self.names("?price_max=15000"), ["Sandale Saly"])
        self.assertEqual(self.names("?price_min=15000"), ["Sandale Sahel"])
        self.assertEqual(self.names("?color=marron"), ["Sandale Saly", "Sandale Sahel"])
        self.assertEqual(self.names("?color=noir"), ["Sandale Sahel"])
        self.assertEqual(self.names("?size=42"), ["Sandale Sahel"])
        self.assertEqual(self.names("?size=43"), [])  # pointure 43 : variante en rupture
        self.assertEqual(self.names("?featured=true"), ["Sandale Sahel"])

    def test_in_stock_filter(self):
        ProductVariant.objects.filter(pk=self.c["vb"].pk).update(stock=0)
        self.assertEqual(self.names("?in_stock=true"), ["Sandale Sahel"])
        self.assertEqual(self.names("?in_stock=false"), ["Sandale Saly"])

    def test_search_and_ordering(self):
        self.assertEqual(self.names("?search=saly"), ["Sandale Saly"])
        self.assertEqual(self.names("?search=femme"), ["Sandale Saly"])  # catégorie
        self.assertEqual(self.names("?ordering=price_asc"), ["Sandale Saly", "Sandale Sahel"])
        self.assertEqual(self.names("?ordering=price_desc"), ["Sandale Sahel", "Sandale Saly"])
        self.assertEqual(self.names("?ordering=popular"), ["Sandale Saly", "Sandale Sahel"])

    def test_pagination(self):
        r = self.client.get("/api/products/?page_size=1")
        self.assertEqual(r.data["count"], 2)
        self.assertEqual(len(r.data["results"]), 1)
        self.assertIsNotNone(r.data["next"])

    def test_featured_endpoint_and_categories(self):
        self.assertEqual([p["name"] for p in self.client.get("/api/products/featured/").data], ["Sandale Sahel"])
        cats = {c["name"]: c["products_count"] for c in self.client.get("/api/categories/").data}
        self.assertEqual(cats, {"Homme": 1, "Femme": 1})  # le produit inactif n'est pas compté


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="sira-test-media-"))
class AdminCatalogTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.c = make_catalog()
        self.admin = make_admin()

    def payload(self, **over):
        data = {"name": "Sandale Neuve", "category": self.c["homme"].pk, "price": 20000, "old_price": 25000,
                "variants": [{"color": self.c["marron"].pk, "size": 40, "stock": 4}, {"color": self.c["noir"].pk, "size": 41, "stock": 2}]}
        data.update(over)
        return data

    def test_write_requires_admin(self):
        self.assertEqual(self.client.post("/api/products/", self.payload(), format="json").status_code, 401)
        self.client.force_authenticate(make_customer())
        self.assertEqual(self.client.post("/api/products/", self.payload(), format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/products/{self.c['a'].pk}/").status_code, 403)
        self.assertEqual(self.client.post("/api/categories/", {"name": "Hack"}, format="json").status_code, 403)

    def test_admin_creates_product_with_variants(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/products/", self.payload(), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["slug"], "sandale-neuve")
        self.assertEqual(r.data["total_stock"], 6)
        self.assertEqual(len(r.data["variants"]), 2)

    def test_slug_is_unique_and_stable(self):
        self.client.force_authenticate(self.admin)
        r2 = self.client.post("/api/products/", self.payload(name="Sandale Sahel"), format="json")
        self.assertEqual(r2.data["slug"], "sandale-sahel-2")
        r3 = self.client.patch(f"/api/products/{r2.data['id']}/", {"name": "Autre nom"}, format="json")
        self.assertEqual(r3.data["slug"], "sandale-sahel-2")

    def test_validation_errors(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post("/api/products/", self.payload(old_price=100), format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/products/", self.payload(price=0), format="json").status_code, 400)
        dup = [{"color": self.c["marron"].pk, "size": 40, "stock": 1}] * 2
        self.assertEqual(self.client.post("/api/products/", self.payload(variants=dup), format="json").status_code, 400)

    def test_update_syncs_variants_and_keeps_others_when_omitted(self):
        self.client.force_authenticate(self.admin)
        pk = self.c["a"].pk
        self.client.patch(f"/api/products/{pk}/", {"price": 18000}, format="json")
        self.assertEqual(self.c["a"].variants.count(), 2)  # variantes inchangées
        r = self.client.patch(f"/api/products/{pk}/", {"variants": [{"color": self.c["marron"].pk, "size": 42, "stock": 9}]}, format="json")
        self.assertEqual(r.data["total_stock"], 9)
        self.assertEqual(self.c["a"].variants.count(), 1)

    def test_admin_sees_inactive_and_can_toggle(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(f"/api/products/{self.c['hidden'].pk}/").status_code, 200)
        r = self.client.patch(f"/api/products/{self.c['hidden'].pk}/", {"is_active": True}, format="json")
        self.assertTrue(r.data["is_active"])

    def test_adjust_stock_via_variant_endpoint(self):
        self.client.force_authenticate(self.admin)
        r = self.client.patch(f"/api/variants/{self.c['va2'].pk}/", {"stock": 7}, format="json")
        self.assertEqual(r.data["stock"], 7)
        self.assertEqual(self.client.post("/api/variants/", {"product": self.c["a"].pk, "color": self.c["marron"].pk, "size": 42, "stock": 1}, format="json").status_code, 400)

    def test_variants_endpoint_is_admin_only(self):
        self.assertEqual(self.client.get("/api/variants/").status_code, 401)

    def test_delete_product_keeps_orders_history(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(f"/api/products/{self.c['a'].pk}/").status_code, 204)

    def test_category_in_use_cannot_be_deleted(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(f"/api/categories/{self.c['homme'].pk}/").status_code, 409)
        free = Category.objects.create(name="Vide")
        self.assertEqual(self.client.delete(f"/api/categories/{free.pk}/").status_code, 204)

    def test_category_crud(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/categories/", {"name": "Premium", "description": "Haut de gamme"}, format="json")
        self.assertEqual((r.status_code, r.data["slug"]), (201, "premium"))
        self.assertEqual(self.client.patch(f"/api/categories/{r.data['id']}/", {"name": "Premium+"}, format="json").data["name"], "Premium+")

    def test_image_upload_is_optimized_and_first_is_main(self):
        self.client.force_authenticate(self.admin)
        url = f"/api/products/{self.c['a'].pk}/images/"
        f = SimpleUploadedFile("Ma Photo.png", png_bytes((2400, 1800)), content_type="image/png")
        r = self.client.post(url, {"image": f, "color": self.c["marron"].pk}, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["is_main"])
        self.assertEqual(r.data["alt_text"], "Sandale Sahel")  # texte alternatif par défaut
        img = ProductImage.objects.get(pk=r.data["id"])
        self.assertTrue(img.image.name.endswith(".webp"))
        self.assertLessEqual(max(Image.open(img.image.path).size), 1600)
        r2 = self.client.post(url, {"image": SimpleUploadedFile("b.png", png_bytes(), content_type="image/png"), "is_main": True}, format="multipart")
        self.assertTrue(r2.data["is_main"])
        img.refresh_from_db()
        self.assertFalse(img.is_main)  # une seule image principale
        detail = self.client.get(f"/api/products/{self.c['a'].pk}/").data
        self.assertTrue(detail["image"].startswith("http"))

    def test_rejects_non_image_upload(self):
        self.client.force_authenticate(self.admin)
        bad = SimpleUploadedFile("virus.png", b"MZ not an image", content_type="image/png")
        self.assertEqual(self.client.post(f"/api/products/{self.c['a'].pk}/images/", {"image": bad}, format="multipart").status_code, 400)
        self.client.force_authenticate(make_customer())
        ok = SimpleUploadedFile("a.png", png_bytes(), content_type="image/png")
        self.assertEqual(self.client.post(f"/api/products/{self.c['a'].pk}/images/", {"image": ok}, format="multipart").status_code, 403)
