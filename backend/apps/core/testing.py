"""Fabriques utilisées par les tests."""
from django.contrib.auth import get_user_model

from apps.catalog.models import Category, Color, Product, ProductVariant
from apps.orders.models import DeliveryZone

User = get_user_model()


def make_admin(email="admin@test.sn", password="Admin-pass-123"):
    return User.objects.create_superuser(email=email, password=password)


def make_customer(email="client@test.sn", password="Client-pass-123"):
    return User.objects.create_user(email=email, password=password, first_name="Awa", last_name="Diop")


def make_catalog():
    """2 catégories, 2 couleurs, 3 produits dont un inactif ; renvoie un dict de repères."""
    homme, femme = Category.objects.create(name="Homme"), Category.objects.create(name="Femme")
    marron, noir = Color.objects.create(name="Marron", hex_code="#7a4a2a"), Color.objects.create(name="Noir", hex_code="#221a15")
    a = Product.objects.create(name="Sandale Sahel", category=homme, price=17500, popularity=70, is_featured=True)
    b = Product.objects.create(name="Sandale Saly", category=femme, price=14000, old_price=19000, popularity=90)
    hidden = Product.objects.create(name="Sandale Cachée", category=homme, price=10000, is_active=False)
    va1 = ProductVariant.objects.create(product=a, color=marron, size=42, stock=5)
    va2 = ProductVariant.objects.create(product=a, color=noir, size=43, stock=0)
    vb = ProductVariant.objects.create(product=b, color=marron, size=38, stock=3)
    vh = ProductVariant.objects.create(product=hidden, color=noir, size=40, stock=9)
    zone = DeliveryZone.objects.create(name="Dakar", fee=2000)
    tbc = DeliveryZone.objects.create(name="Autre zone", fee=None)
    return dict(homme=homme, femme=femme, marron=marron, noir=noir, a=a, b=b, hidden=hidden, va1=va1, va2=va2, vb=vb, vh=vh, zone=zone, tbc=tbc)
