"""Initialisation de la boutique à chaque déploiement (Render : commande de build). Idempotent.

    python manage.py bootstrap

Étapes : migrations, réglages de la boutique, catégories, couleurs et zones de livraison par défaut
(créés seulement s'ils n'existent pas : vos modifications ne sont jamais écrasées), compte administrateur,
et, si LOAD_DEMO_DATA=true, catalogue de démonstration (une seule fois, tant qu'il n'y a aucun produit).

Variables d'environnement : DJANGO_SUPERUSER_EMAIL, DJANGO_SUPERUSER_PASSWORD (12 caractères minimum),
SHOP_WHATSAPP, SHOP_EMAIL, LOAD_DEMO_DATA.
"""
import os

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.catalog.models import Category, Color
from apps.core.models import ShopSettings
from apps.orders.models import DeliveryZone

from ._demo_data import CATEGORIES, COLORS, ZONES

MIN_PASSWORD = 12


class Command(BaseCommand):
    help = "Migrations + données de base + administrateur (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--no-migrate", action="store_true", help="Ne pas lancer les migrations.")

    def handle(self, *args, **opts):
        if not opts["no_migrate"]:
            call_command("migrate", interactive=False, verbosity=1)
        self._defaults()
        self._superuser()
        if os.environ.get("LOAD_DEMO_DATA", "").lower() in ("1", "true", "yes", "oui"):
            call_command("seed_demo", if_empty=True)
        self.stdout.write(self.style.SUCCESS("Boutique initialisée."))

    def _defaults(self):
        shop, created = ShopSettings.objects.get_or_create(pk=1)
        if created:
            shop.whatsapp_number = os.environ.get("SHOP_WHATSAPP", shop.whatsapp_number)
            shop.email = os.environ.get("SHOP_EMAIL", "")
            shop.save()
        for i, name in enumerate(CATEGORIES):
            Category.objects.get_or_create(name=name, defaults={"position": i})
        for name, hex_code in COLORS.items():
            Color.objects.get_or_create(name=name, defaults={"hex_code": hex_code})
        for i, (name, fee) in enumerate(ZONES):
            DeliveryZone.objects.get_or_create(name=name, defaults={"fee": fee, "position": i})

    def _superuser(self):
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "").strip().lower()
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
        if not email or not password:
            self.stdout.write("Aucun administrateur créé (DJANGO_SUPERUSER_EMAIL / DJANGO_SUPERUSER_PASSWORD non définis).")
            return
        User = get_user_model()
        if User.objects.filter(email=email).exists():
            self.stdout.write(f"Administrateur {email} déjà existant : inchangé.")
        elif len(password) < MIN_PASSWORD:
            self.stdout.write(self.style.WARNING(f"Administrateur NON créé : le mot de passe doit faire au moins {MIN_PASSWORD} caractères."))
        else:
            User.objects.create_superuser(email=email, password=password)
            self.stdout.write(self.style.SUCCESS(f"Administrateur créé : {email}"))
