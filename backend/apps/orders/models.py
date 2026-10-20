from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.catalog.models import Product, ProductVariant
from apps.core.models import TimeStampedModel


class DeliveryZone(models.Model):
    """Zone de livraison et ses frais (modifiables par l'administrateur). Frais vides = « À confirmer »."""

    name = models.CharField("zone", max_length=80, unique=True)
    fee = models.PositiveIntegerField("frais de livraison (FCFA)", null=True, blank=True, help_text="Laisser vide pour « À confirmer ».")
    is_active = models.BooleanField("active", default=True)
    position = models.PositiveSmallIntegerField("ordre d'affichage", default=0)

    class Meta:
        ordering = ["position", "name"]
        verbose_name = "zone de livraison"
        verbose_name_plural = "zones de livraison"

    def __str__(self):
        return self.name


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        NEW = "nouvelle", "Nouvelle"
        CONFIRMED = "confirmee", "Confirmée"
        PREPARING = "preparation", "En préparation"
        SHIPPED = "expediee", "Expédiée"
        DELIVERED = "livree", "Livrée"
        CANCELLED = "annulee", "Annulée"

    class DeliveryMode(models.TextChoices):
        DELIVERY = "livraison", "Livraison à domicile"
        PICKUP = "retrait", "Retrait en boutique"

    # Parcours normal ; une commande peut être annulée tant qu'elle n'est pas livrée.
    FLOW = [Status.NEW, Status.CONFIRMED, Status.PREPARING, Status.SHIPPED, Status.DELIVERED]

    number = models.CharField("numéro de commande", max_length=20, unique=True, null=True, blank=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="orders", verbose_name="compte client")
    first_name = models.CharField("prénom", max_length=80)
    last_name = models.CharField("nom", max_length=80)
    phone = models.CharField("téléphone", max_length=20, db_index=True)
    email = models.EmailField("e-mail", blank=True)
    address = models.CharField("adresse de livraison", max_length=255, blank=True)
    zone = models.ForeignKey(DeliveryZone, null=True, blank=True, on_delete=models.SET_NULL, related_name="orders", verbose_name="zone")
    zone_name = models.CharField("zone (copie)", max_length=80, blank=True)
    delivery_mode = models.CharField("mode de livraison", max_length=10, choices=DeliveryMode.choices, default=DeliveryMode.DELIVERY)
    delivery_fee = models.PositiveIntegerField("frais de livraison", default=0)
    delivery_fee_to_confirm = models.BooleanField("frais à confirmer", default=False)
    subtotal = models.PositiveIntegerField("sous-total", default=0)
    total = models.PositiveIntegerField("total", default=0)
    status = models.CharField("statut", max_length=12, choices=Status.choices, default=Status.NEW, db_index=True)
    notes = models.TextField("informations du client", blank=True)
    admin_notes = models.TextField("notes internes", blank=True)
    stock_restored = models.BooleanField("stock restitué", default=False, editable=False)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "commande"
        verbose_name_plural = "commandes"

    def __str__(self):
        return self.number or f"Commande #{self.pk}"

    def save(self, *args, **kwargs):
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating and not self.number:
            self.number = f"CMD-{timezone.localdate().year}-{self.pk:05d}"
            super().save(update_fields=["number"])

    @property
    def customer_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @classmethod
    def can_transition(cls, current, new):
        if current == new or current in (cls.Status.DELIVERED, cls.Status.CANCELLED):
            return False
        if new == cls.Status.CANCELLED:
            return True
        return cls.FLOW.index(new) > cls.FLOW.index(current) if new in cls.FLOW and current in cls.FLOW else False

    @classmethod
    def next_statuses(cls, current):
        return [s.value for s in cls.Status if cls.can_transition(current, s)]


class OrderItem(models.Model):
    """Ligne de commande : les informations produit sont copiées au moment de l'achat."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, null=True, on_delete=models.SET_NULL, related_name="+")
    variant = models.ForeignKey(ProductVariant, null=True, on_delete=models.SET_NULL, related_name="+")
    product_name = models.CharField("produit", max_length=160)
    color_name = models.CharField("couleur", max_length=40)
    size = models.PositiveSmallIntegerField("taille")
    unit_price = models.PositiveIntegerField("prix unitaire")
    quantity = models.PositiveSmallIntegerField("quantité")

    class Meta:
        verbose_name = "article"
        verbose_name_plural = "articles"

    def __str__(self):
        return f"{self.quantity} × {self.product_name} ({self.color_name}, T.{self.size})"

    @property
    def line_total(self):
        return self.unit_price * self.quantity


class OrderStatusEvent(models.Model):
    """Historique des changements de statut."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="events")
    from_status = models.CharField(max_length=12, blank=True)
    to_status = models.CharField(max_length=12)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "événement de statut"
        verbose_name_plural = "historique des statuts"
