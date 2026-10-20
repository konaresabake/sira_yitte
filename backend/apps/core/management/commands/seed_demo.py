"""Charge des données de démonstration : réglages, catégories, couleurs, zones, produits, (commandes), administrateur.

    python manage.py seed_demo                 # catalogue + zones + administrateur (DEBUG)
    python manage.py seed_demo --orders 12     # + commandes de démonstration
    python manage.py seed_demo --reset         # repart d'un catalogue vide (supprime produits et commandes)
"""
import os
import random
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Category, Color, Product, ProductImage, ProductVariant
from apps.core.models import ShopSettings
from apps.orders import services
from apps.orders.models import DeliveryZone, Order

from ._demo_data import CATEGORIES, COLORS, PRODUCTS, ZONES

PHOTOS = {"gris": "sandale-sahara-gris.webp", "rouge": "sandale-soleil-bordeaux.webp"}
CUSTOMERS = [("Awa", "Diop", "77 412 08 15", "Pikine"), ("Moussa", "Fall", "78 120 33 44", "Dakar"), ("Fatou", "Sarr", "76 905 11 22", "Guédiawaye"),
             ("Ibrahima", "Ndiaye", "77 330 90 01", "Dakar"), ("Khady", "Ba", "70 555 12 12", "Pikine"), ("Cheikh", "Sy", "77 888 45 67", "Dakar"),
             ("Mariama", "Diallo", "78 777 00 99", "Dakar"), ("Omar", "Gueye", "76 100 20 30", "Pikine")]


class Command(BaseCommand):
    help = "Charge des données de démonstration."

    def add_arguments(self, parser):
        parser.add_argument("--if-empty", action="store_true", help="Ne fait rien si des produits existent déjà.")
        parser.add_argument("--reset", action="store_true", help="Supprime produits, catégories et commandes avant de recharger.")
        parser.add_argument("--orders", type=int, default=0, help="Nombre de commandes de démonstration à créer.")
        parser.add_argument("--admin-email", default=os.environ.get("ADMIN_EMAIL", "admin@sirayitte.sn"))
        parser.add_argument("--admin-password", default=os.environ.get("ADMIN_PASSWORD", ""))

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts["if_empty"] and Product.objects.exists():
            self.stdout.write("Des produits existent déjà : données de démonstration ignorées.")
            return
        if opts["reset"]:
            Order.objects.all().delete()
            Product.objects.all().delete()
            Category.objects.all().delete()
            self.stdout.write("Catalogue et commandes supprimés.")

        shop = ShopSettings.load()
        shop.shop_name, shop.whatsapp_number = "Sira Yitte", "221775857358"
        shop.save()

        colors = {n: Color.objects.update_or_create(name=n, defaults={"hex_code": h})[0] for n, h in COLORS.items()}
        cats = {n: Category.objects.get_or_create(name=n, defaults={"position": i})[0] for i, n in enumerate(CATEGORIES)}
        for i, (name, fee) in enumerate(ZONES):
            DeliveryZone.objects.update_or_create(name=name, defaults={"fee": fee, "position": i})

        now = timezone.now()
        for i, row in enumerate(PRODUCTS):
            name, cat, price, old, _model, cols, desc, pop, rank, feat, (smin, smax) = row[:11]
            photo = row[11] if len(row) > 11 else ""
            product, created = Product.objects.get_or_create(name=name, defaults={
                "category": cats[cat], "description": desc, "price": price, "old_price": old or None, "is_featured": bool(feat),
                "popularity": pop, "material": "Daim de vache, cuir gaufré, semelle gomme noire" if photo == "gris" else "Cuir de vache véritable, semelle en cuir et gomme"})
            if created:
                Product.objects.filter(pk=product.pk).update(created_at=now - timedelta(days=(10 - rank) * 15))
                for ci, c in enumerate(cols):
                    for si, size in enumerate(range(smin, smax + 1)):
                        v = (i * 5 + ci * 3 + si * 7) % 10
                        ProductVariant.objects.create(product=product, color=colors[c], size=size, stock=0 if v < 2 else v)
                if photo:
                    path = Path(settings.BASE_DIR) / "seed_assets" / PHOTOS[photo]
                    with open(path, "rb") as fh:
                        img = ProductImage(product=product, color=colors[cols[0]], alt_text=name, is_main=True)
                        img.image.save(PHOTOS[photo], File(fh), save=True)

        self._admin(opts)
        if opts["orders"]:
            self._orders(opts["orders"])
        self.stdout.write(self.style.SUCCESS(
            f"Données chargées : {Product.objects.count()} produits, {Category.objects.count()} catégories, "
            f"{DeliveryZone.objects.count()} zones, {Order.objects.count()} commandes."))

    def _admin(self, opts):
        User = get_user_model()
        email, password = opts["admin_email"].lower(), opts["admin_password"]
        if User.objects.filter(email=email).exists():
            return
        if not password:
            if not settings.DEBUG:
                self.stdout.write(self.style.WARNING("Administrateur non créé (hors DEBUG). Utilisez --admin-password ou `createsuperuser`."))
                return
            password = "admin123"
        User.objects.create_superuser(email=email, password=password, first_name="Admin", last_name="Sira Yitte")
        self.stdout.write(f"Administrateur créé : {email}" + (f" / {password}" if settings.DEBUG else ""))

    def _orders(self, count):
        rng = random.Random(42)
        variants = list(ProductVariant.objects.filter(stock__gte=3, product__is_active=True))
        zones = {z.name: z for z in DeliveryZone.objects.all()}
        if not variants:
            raise CommandError("Aucune variante en stock pour créer des commandes.")
        flow = [Order.Status.NEW, Order.Status.CONFIRMED, Order.Status.PREPARING, Order.Status.SHIPPED, Order.Status.DELIVERED]
        for n in range(count):
            first, last, phone, zone = rng.choice(CUSTOMERS)
            picks = rng.sample(variants, k=rng.choice([1, 1, 2]))
            order = services.create_order(data={
                "first_name": first, "last_name": last, "phone": phone, "address": f"Rue {rng.randint(3, 40)}, {zone}",
                "zone": zones[zone], "delivery_mode": Order.DeliveryMode.DELIVERY,
                "items": [{"variant": v, "quantity": 1} for v in picks]})
            target = rng.choice(flow + [Order.Status.CANCELLED])
            if target == Order.Status.CANCELLED:
                services.change_status(order, target)
            else:
                for st in flow[1:flow.index(target) + 1]:
                    services.change_status(order, st)
            Order.objects.filter(pk=order.pk).update(created_at=timezone.now() - timedelta(days=rng.randint(0, 6), hours=rng.randint(0, 20)))
