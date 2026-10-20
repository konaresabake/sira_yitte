"""Logique métier des commandes : création atomique, gestion du stock, changements de statut."""
from collections import defaultdict

from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import ValidationError

from apps.catalog.models import ProductVariant

from . import notifications
from .models import Order, OrderItem, OrderStatusEvent


@transaction.atomic
def create_order(*, data, user=None):
    """Crée une commande. Prix, frais et totaux sont recalculés côté serveur (jamais lus du client).
    Le stock est verrouillé puis décrémenté dans la même transaction : tout ou rien."""
    wanted = defaultdict(int)
    for item in data["items"]:
        wanted[item["variant"].pk] += item["quantity"]

    variants = {
        v.pk: v
        for v in ProductVariant.objects.select_for_update(of=("self",)).select_related("product", "product__category", "color").filter(pk__in=wanted)
    }
    errors = []
    for pk, qty in wanted.items():
        v = variants[pk]
        label = f"{v.product.name} ({v.color.name}, taille {v.size})"
        if not v.product.is_active or not v.product.category.is_active:
            errors.append(f"{label} n'est plus disponible à la vente.")
        elif v.stock <= 0:
            errors.append(f"{label} : rupture de stock.")
        elif qty > v.stock:
            errors.append(f"{label} : seulement {v.stock} disponible(s) pour {qty} demandé(s).")
    if errors:
        raise ValidationError({"items": errors})

    mode, zone = data["delivery_mode"], data.get("zone")
    if mode == Order.DeliveryMode.PICKUP:
        zone, fee, tbc = None, 0, False
    else:
        fee, tbc = (0, True) if zone.fee is None else (zone.fee, False)

    subtotal = sum(variants[pk].product.price * qty for pk, qty in wanted.items())
    order = Order.objects.create(
        user=user if user and user.is_authenticated else None,
        first_name=data["first_name"], last_name=data["last_name"], phone=data["phone"], email=data.get("email", ""),
        address=data.get("address", ""), zone=zone, zone_name=zone.name if zone else "",
        delivery_mode=mode, delivery_fee=fee, delivery_fee_to_confirm=tbc,
        subtotal=subtotal, total=subtotal + fee, notes=data.get("notes", ""),
    )
    OrderItem.objects.bulk_create([
        OrderItem(order=order, product=v.product, variant=v, product_name=v.product.name, color_name=v.color.name,
                  size=v.size, unit_price=v.product.price, quantity=wanted[pk])
        for pk, v in variants.items()
    ])
    for pk, qty in wanted.items():  # mise à jour conditionnelle : protège même sans verrou de ligne
        if not ProductVariant.objects.filter(pk=pk, stock__gte=qty).update(stock=F("stock") - qty):
            raise ValidationError({"items": ["Le stock vient de changer, veuillez réessayer."]})
    OrderStatusEvent.objects.create(order=order, from_status="", to_status=order.status, changed_by=user if user and user.is_authenticated else None, note="Commande créée")
    transaction.on_commit(lambda: notifications.notify_new_order(order.pk))
    return order


@transaction.atomic
def change_status(order, new_status, *, by=None, note=""):
    """Change le statut en respectant le parcours ; une annulation restitue le stock (une seule fois)."""
    order = Order.objects.select_for_update().get(pk=order.pk)
    if new_status == order.status:
        return order
    if not Order.can_transition(order.status, new_status):
        raise ValidationError({"status": f"Transition impossible : « {order.get_status_display()} » vers « {Order.Status(new_status).label} »."})
    if new_status == Order.Status.CANCELLED and not order.stock_restored:
        for item in order.items.exclude(variant__isnull=True):
            ProductVariant.objects.filter(pk=item.variant_id).update(stock=F("stock") + item.quantity)
        order.stock_restored = True
    old = order.status
    order.status = new_status
    order.save(update_fields=["status", "stock_restored", "updated_at"])
    OrderStatusEvent.objects.create(order=order, from_status=old, to_status=new_status, changed_by=by, note=note)
    transaction.on_commit(lambda: notifications.notify_status_change(order.pk))
    return order
