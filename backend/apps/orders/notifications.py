"""Notifications : vendeur (nouvelle commande) et client (confirmation, changement de statut).

Première version par e-mail (console en développement, SMTP en production). Les erreurs d'envoi ne
bloquent jamais une commande. Le lien WhatsApp renvoyé par l'API permet aussi de prévenir par WhatsApp.
"""
import logging

from django.core.mail import send_mail

from apps.core.models import ShopSettings

from .models import Order

logger = logging.getLogger(__name__)


def _fcfa(n):
    return f"{n:,}".replace(",", " ") + " FCFA"


def order_summary(order):
    lines = [f"- {i.quantity} × {i.product_name} (taille {i.size}, {i.color_name}) : {_fcfa(i.line_total)}" for i in order.items.all()]
    fee = "À confirmer" if order.delivery_fee_to_confirm else _fcfa(order.delivery_fee)
    return "\n".join(lines) + f"\n\nSous-total : {_fcfa(order.subtotal)}\nLivraison : {fee}\nTotal : {_fcfa(order.total)}"


def _send(subject, body, to):
    try:
        send_mail(subject, body, None, [to], fail_silently=False)
    except Exception:  # noqa: BLE001 - une notification ne doit jamais faire échouer la commande
        logger.exception("Échec d'envoi d'e-mail à %s", to)


def notify_new_order(order_id):
    order = Order.objects.prefetch_related("items").get(pk=order_id)
    shop = ShopSettings.load()
    logger.info("Nouvelle commande %s (%s)", order.number, _fcfa(order.total))
    if shop.email:
        _send(
            f"[{shop.shop_name}] Nouvelle commande {order.number}",
            f"Client : {order.customer_name} ({order.phone})\nMode : {order.get_delivery_mode_display()}\n"
            f"Zone : {order.zone_name or '-'}\nAdresse : {order.address or '-'}\n\n{order_summary(order)}",
            shop.email,
        )
    if order.email:
        _send(
            f"{shop.shop_name} - Commande {order.number} reçue",
            f"Bonjour {order.first_name},\n\nMerci pour votre commande {order.number}. Nous la préparons avec soin.\n\n"
            f"{order_summary(order)}\n\nUne question ? WhatsApp : +{shop.whatsapp_number}\n\n{shop.shop_name} - {shop.tagline}",
            order.email,
        )


def notify_status_change(order_id):
    order = Order.objects.get(pk=order_id)
    if order.email:
        shop = ShopSettings.load()
        _send(
            f"{shop.shop_name} - Commande {order.number} : {order.get_status_display()}",
            f"Bonjour {order.first_name},\n\nLe statut de votre commande {order.number} est maintenant : {order.get_status_display()}.\n\n{shop.shop_name}",
            order.email,
        )
