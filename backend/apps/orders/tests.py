from django.core import mail
from django.core.cache import cache
from rest_framework.test import APITestCase

from apps.catalog.models import ProductVariant
from apps.core.models import ShopSettings
from apps.core.testing import make_admin, make_catalog, make_customer
from apps.orders.models import Order


class OrderBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.c = make_catalog()

    def stock(self, v):
        return ProductVariant.objects.get(pk=v.pk).stock

    def body(self, **over):
        data = {"first_name": "Awa", "last_name": "Diop", "phone": "+221 77 412 08 15", "address": "Rue 10, Pikine",
                "zone": self.c["zone"].pk, "delivery_mode": "livraison", "items": [{"variant": self.c["va1"].pk, "quantity": 2}]}
        data.update(over)
        return data

    def order(self, **over):
        return self.client.post("/api/orders/", self.body(**over), format="json")


class CreateOrderTests(OrderBase):
    def test_creates_order_with_server_side_totals_and_decrements_stock(self):
        r = self.order()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertRegex(r.data["number"], r"^CMD-\d{4}-\d{5}$")
        self.assertEqual((r.data["subtotal"], r.data["delivery_fee"], r.data["total"]), (35000, 2000, 37000))
        self.assertEqual(r.data["status"], "nouvelle")
        self.assertEqual(r.data["phone"], "774120815")
        self.assertEqual(self.stock(self.c["va1"]), 3)
        self.assertEqual(r.data["items"][0]["product_name"], "Sandale Sahel")
        self.assertTrue(r.data["whatsapp_url"].startswith("https://wa.me/"))
        self.assertNotIn("admin_notes", r.data)

    def test_client_cannot_impose_prices(self):
        body = self.body(total=1, subtotal=1, delivery_fee=0)
        body["items"][0]["unit_price"] = 1
        r = self.client.post("/api/orders/", body, format="json")
        self.assertEqual(r.data["total"], 37000)

    def test_merges_duplicate_lines(self):
        r = self.order(items=[{"variant": self.c["va1"].pk, "quantity": 1}, {"variant": self.c["va1"].pk, "quantity": 2}])
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.stock(self.c["va1"]), 2)
        self.assertEqual(r.data["items"][0]["quantity"], 3)

    def test_pickup_has_no_fee_and_no_zone_required(self):
        r = self.order(delivery_mode="retrait", zone=None, address="")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data["delivery_fee"], r.data["total"]), (0, 35000))

    def test_unknown_fee_zone_is_flagged_to_confirm(self):
        r = self.order(zone=self.c["tbc"].pk)
        self.assertTrue(r.data["delivery_fee_to_confirm"])
        self.assertEqual(r.data["total"], 35000)

    def test_insufficient_stock_rejected_and_nothing_changes(self):
        r = self.order(items=[{"variant": self.c["vb"].pk, "quantity": 1}, {"variant": self.c["va1"].pk, "quantity": 6}])
        self.assertEqual(r.status_code, 400)
        self.assertIn("seulement 5", r.data["items"][0])
        self.assertEqual(self.stock(self.c["va1"]), 5)
        self.assertEqual(self.stock(self.c["vb"]), 3)  # aucune ligne partiellement appliquée
        self.assertEqual(Order.objects.count(), 0)

    def test_out_of_stock_and_inactive_rejected(self):
        self.assertEqual(self.order(items=[{"variant": self.c["va2"].pk, "quantity": 1}]).status_code, 400)
        self.assertEqual(self.order(items=[{"variant": self.c["vh"].pk, "quantity": 1}]).status_code, 400)

    def test_validation(self):
        self.assertEqual(self.order(items=[]).status_code, 400)
        self.assertEqual(self.order(phone="12").status_code, 400)
        self.assertEqual(self.order(zone=None).status_code, 400)  # livraison sans zone
        self.assertEqual(self.order(address="").status_code, 400)
        self.assertEqual(self.order(items=[{"variant": self.c["va1"].pk, "quantity": 0}]).status_code, 400)
        self.assertEqual(self.order(items=[{"variant": 99999, "quantity": 1}]).status_code, 400)
        self.assertEqual(self.order(email="pas-un-email").status_code, 400)

    def test_notifications_to_seller_and_customer(self):
        shop = ShopSettings.load()
        shop.email = "boutique@sirayitte.sn"
        shop.save()
        with self.captureOnCommitCallbacks(execute=True):
            r = self.order(email="awa@test.sn")
        recipients = sorted(m.to[0] for m in mail.outbox)
        self.assertEqual(recipients, ["awa@test.sn", "boutique@sirayitte.sn"])
        self.assertIn(r.data["number"], mail.outbox[0].subject)

    def test_email_failure_never_blocks_order(self):
        shop = ShopSettings.load()
        shop.email = "boutique@sirayitte.sn"
        shop.save()
        with self.settings(EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend", EMAIL_HOST="127.0.0.1", EMAIL_PORT=1):
            with self.captureOnCommitCallbacks(execute=True):
                r = self.order()
        self.assertEqual(r.status_code, 201)

    def test_logged_in_customer_is_linked_to_order(self):
        user = make_customer()
        self.client.force_authenticate(user)
        r = self.order()
        self.assertEqual(Order.objects.get(pk=r.data["id"]).user, user)

    def test_order_creation_is_throttled(self):
        for _ in range(20):
            self.order(items=[{"variant": self.c["vb"].pk, "quantity": 0}])  # requêtes invalides, mais comptées
        self.assertEqual(self.order().status_code, 429)


class ReadAndPermissionTests(OrderBase):
    def test_anonymous_cannot_list_or_read_orders(self):
        r = self.order()
        self.assertEqual(self.client.get("/api/orders/").status_code, 401)
        self.assertEqual(self.client.get(f"/api/orders/{r.data['id']}/").status_code, 401)
        self.assertEqual(self.client.patch(f"/api/orders/{r.data['id']}/", {"status": "confirmee"}, format="json").status_code, 401)

    def test_customer_sees_only_own_orders(self):
        mine, other = make_customer("a@test.sn"), make_customer("b@test.sn")
        self.client.force_authenticate(mine)
        o1 = self.order().data
        self.client.force_authenticate(other)
        o2 = self.order(items=[{"variant": self.c["vb"].pk, "quantity": 1}]).data
        self.client.force_authenticate(mine)
        listing = self.client.get("/api/orders/").data["results"]
        self.assertEqual([o["id"] for o in listing], [o1["id"]])
        self.assertEqual(self.client.get(f"/api/orders/{o2['id']}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/orders/{o1['id']}/", {"status": "confirmee"}, format="json").status_code, 403)

    def test_admin_lists_filters_and_searches(self):
        n1 = self.order().data
        n2 = self.order(first_name="Moussa", last_name="Fall", phone="78 120 33 44", items=[{"variant": self.c["vb"].pk, "quantity": 1}]).data
        self.client.force_authenticate(make_admin())
        self.assertEqual(self.client.get("/api/orders/").data["count"], 2)
        self.assertEqual(self.client.get("/api/orders/?search=moussa").data["count"], 1)
        self.assertEqual(self.client.get("/api/orders/?search=78 120").data["count"], 1)
        self.assertEqual(self.client.get(f"/api/orders/?search={n1['number']}").data["count"], 1)
        self.client.patch(f"/api/orders/{n2['id']}/", {"status": "confirmee"}, format="json")
        self.assertEqual(self.client.get("/api/orders/?status=confirmee").data["count"], 1)
        self.assertEqual(self.client.get("/api/orders/?status=nouvelle").data["count"], 1)

    def test_public_tracking_by_number_and_phone(self):
        r = self.order().data
        ok = self.client.get("/api/orders/track/", {"number": r["number"], "phone": "77 412 08 15"})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data["status"], "nouvelle")
        self.assertNotIn("phone", ok.data)
        self.assertNotIn("address", ok.data)
        self.assertEqual(self.client.get("/api/orders/track/", {"number": r["number"], "phone": "700000000"}).status_code, 404)
        self.assertEqual(self.client.get("/api/orders/track/", {"number": r["number"]}).status_code, 400)


class StatusTests(OrderBase):
    def setUp(self):
        super().setUp()
        self.admin = make_admin()
        self.o = self.order().data

    def patch(self, status, **extra):
        self.client.force_authenticate(self.admin)
        return self.client.patch(f"/api/orders/{self.o['id']}/", {"status": status, **extra}, format="json")

    def test_full_flow_records_history(self):
        for st in ["confirmee", "preparation", "expediee", "livree"]:
            r = self.patch(st)
            self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status_label"], "Livrée")
        self.assertEqual(len(r.data["events"]), 5)
        self.assertEqual(r.data["allowed_next_statuses"], [])

    def test_invalid_transitions(self):
        self.assertEqual(self.patch("livree").status_code, 200)  # saut en avant autorisé
        self.assertEqual(self.patch("nouvelle").status_code, 400)  # retour en arrière interdit
        self.assertEqual(self.patch("annulee").status_code, 400)  # une commande livrée ne s'annule plus

    def test_cancel_restores_stock_once(self):
        self.assertEqual(self.stock(self.c["va1"]), 3)
        self.assertEqual(self.patch("annulee").status_code, 200)
        self.assertEqual(self.stock(self.c["va1"]), 5)
        self.assertEqual(self.patch("annulee").status_code, 200)  # idempotent
        self.assertEqual(self.stock(self.c["va1"]), 5)
        self.assertEqual(self.patch("confirmee").status_code, 400)  # impossible de ressusciter

    def test_admin_notes_visible_to_admin_only(self):
        r = self.client.patch  # noqa: F841
        self.client.force_authenticate(self.admin)
        res = self.client.patch(f"/api/orders/{self.o['id']}/", {"admin_notes": "Appeler avant livraison"}, format="json")
        self.assertEqual(res.data["admin_notes"], "Appeler avant livraison")
        self.client.force_authenticate(None)
        self.assertNotIn("admin_notes", self.client.get("/api/orders/track/", {"number": self.o["number"], "phone": "774120815"}).data)

    def test_customer_cancel_rules(self):
        user = make_customer()
        self.client.force_authenticate(user)
        mine = self.order().data
        self.assertEqual(self.stock(self.c["va1"]), 1)
        self.assertEqual(self.client.post(f"/api/orders/{mine['id']}/cancel/").data["status"], "annulee")
        self.assertEqual(self.stock(self.c["va1"]), 3)
        again = self.order(items=[{"variant": self.c["vb"].pk, "quantity": 1}]).data
        Order.objects.filter(pk=again["id"]).update(status="preparation")
        self.assertEqual(self.client.post(f"/api/orders/{again['id']}/cancel/").status_code, 400)

    def test_status_change_notifies_customer(self):
        o = self.order(email="awa@test.sn", items=[{"variant": self.c["vb"].pk, "quantity": 1}]).data
        mail.outbox.clear()
        self.client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(f"/api/orders/{o['id']}/", {"status": "confirmee"}, format="json")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Confirmée", mail.outbox[0].subject)


class AdminToolsTests(OrderBase):
    def test_dashboard_and_customers_admin_only(self):
        self.assertEqual(self.client.get("/api/dashboard/").status_code, 401)
        self.client.force_authenticate(make_customer())
        self.assertEqual(self.client.get("/api/dashboard/").status_code, 403)
        self.assertEqual(self.client.get("/api/customers/").status_code, 403)

    def test_dashboard_numbers(self):
        o1 = self.order().data
        self.order(first_name="Moussa", phone="78 120 33 44", items=[{"variant": self.c["vb"].pk, "quantity": 1}])
        self.client.force_authenticate(make_admin())
        self.client.patch(f"/api/orders/{o1['id']}/", {"status": "annulee"}, format="json")
        ProductVariant.objects.filter(pk=self.c["vb"].pk).update(stock=0)  # Saly : plus aucune variante en stock
        d = self.client.get("/api/dashboard/").data
        self.assertEqual(d["orders_count"], 2)
        self.assertEqual(d["revenue"], 16000)  # la commande annulée n'est pas comptée
        self.assertEqual(d["new_orders"], 1)
        self.assertEqual(d["orders_by_status"]["annulee"], 1)
        self.assertEqual(len(d["sales_last_7_days"]), 7)
        self.assertEqual(d["sales_last_7_days"][-1]["revenue"], 16000)
        self.assertEqual(d["out_of_stock_products"], 1)
        self.assertTrue(any(v["stock"] == 0 for v in d["low_stock"]))
        self.assertEqual(d["top_products"][0]["product_name"], "Sandale Saly")

    def test_customers_aggregated_by_phone(self):
        self.order()
        self.order(phone="77 412 08 15", items=[{"variant": self.c["vb"].pk, "quantity": 1}])
        self.order(first_name="Moussa", phone="78 120 33 44", items=[{"variant": self.c["vb"].pk, "quantity": 1}])
        self.client.force_authenticate(make_admin())
        res = self.client.get("/api/customers/").data["results"]
        self.assertEqual(len(res), 2)
        self.assertEqual((res[0]["phone"], res[0]["orders_count"], res[0]["total_spent"]), ("774120815", 2, 35000 + 2000 + 14000 + 2000))

    def test_delivery_zones_public_read_admin_write(self):
        from apps.orders.models import DeliveryZone
        DeliveryZone.objects.filter(pk=self.c["tbc"].pk).update(is_active=False)
        names = [z["name"] for z in self.client.get("/api/delivery-zones/").data]
        self.assertEqual(names, ["Dakar"])
        self.assertEqual(self.client.post("/api/delivery-zones/", {"name": "Rufisque", "fee": 2500}, format="json").status_code, 401)
        self.client.force_authenticate(make_admin())
        r = self.client.post("/api/delivery-zones/", {"name": "Rufisque", "fee": None}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["fee_to_confirm"])
        self.assertEqual(len(self.client.get("/api/delivery-zones/").data), 3)  # l'admin voit aussi les zones inactives

    def test_shop_settings(self):
        public = self.client.get("/api/shop/").data
        self.assertEqual(public["whatsapp_number"], "221775857358")
        self.assertNotIn("low_stock_threshold", public)
        self.assertEqual(self.client.patch("/api/shop/", {"whatsapp_number": "221700000000"}, format="json").status_code, 401)
        self.client.force_authenticate(make_admin())
        self.assertEqual(self.client.patch("/api/shop/", {"whatsapp_number": "221700000000"}, format="json").data["whatsapp_number"], "221700000000")
        self.assertEqual(self.client.patch("/api/shop/", {"whatsapp_number": "abc"}, format="json").status_code, 400)

    def test_health(self):
        self.assertEqual(self.client.get("/api/health/").data, {"status": "ok"})
