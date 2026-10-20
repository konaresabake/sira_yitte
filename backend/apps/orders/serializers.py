from rest_framework import serializers

from apps.catalog.models import ProductVariant
from apps.core.models import ShopSettings
from apps.core.utils import normalize_phone, whatsapp_url

from . import services
from .models import DeliveryZone, Order, OrderItem, OrderStatusEvent


class DeliveryZoneSerializer(serializers.ModelSerializer):
    fee_to_confirm = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryZone
        fields = ["id", "name", "fee", "fee_to_confirm", "is_active", "position"]

    def get_fee_to_confirm(self, obj) -> bool:
        return obj.fee is None


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.IntegerField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "variant", "product_name", "color_name", "size", "unit_price", "quantity", "line_total"]


class OrderEventSerializer(serializers.ModelSerializer):
    from_label = serializers.SerializerMethodField()
    to_label = serializers.SerializerMethodField()

    class Meta:
        model = OrderStatusEvent
        fields = ["from_status", "from_label", "to_status", "to_label", "note", "created_at"]

    def get_from_label(self, obj) -> str:
        return Order.Status(obj.from_status).label if obj.from_status else ""

    def get_to_label(self, obj) -> str:
        return Order.Status(obj.to_status).label


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    events = OrderEventSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    delivery_mode_label = serializers.CharField(source="get_delivery_mode_display", read_only=True)
    allowed_next_statuses = serializers.SerializerMethodField()
    whatsapp_url = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "number", "status", "status_label", "allowed_next_statuses",
            "first_name", "last_name", "phone", "email", "address", "zone", "zone_name",
            "delivery_mode", "delivery_mode_label", "delivery_fee", "delivery_fee_to_confirm",
            "subtotal", "total", "notes", "admin_notes", "items", "events", "whatsapp_url", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_allowed_next_statuses(self, obj) -> list[str]:
        return Order.next_statuses(obj.status)

    def get_whatsapp_url(self, obj) -> str:
        # Mise en cache dans le contexte : sans cela, ShopSettings.load() tournait une fois
        # par commande sérialisée (liste de 20 commandes = 20 requêtes).
        shop = self.context.get("shop_settings")
        if shop is None:
            shop = self.context["shop_settings"] = ShopSettings.load()
        text = f"Bonjour, je viens de passer la commande {obj.number} d'un montant de {obj.total} FCFA. Pouvez-vous me confirmer sa prise en charge ?"
        return whatsapp_url(shop.whatsapp_number, text)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if not (request and request.user.is_authenticated and request.user.is_staff):
            data.pop("admin_notes", None)  # notes internes jamais visibles du client
        return data


class OrderPublicSerializer(serializers.ModelSerializer):
    """Suivi public d'une commande (numéro + téléphone) : aucune donnée personnelle renvoyée."""

    items = OrderItemSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = ["number", "status", "status_label", "subtotal", "delivery_fee", "delivery_fee_to_confirm", "total", "items", "created_at", "updated_at"]


class OrderItemInputSerializer(serializers.Serializer):
    variant = serializers.PrimaryKeyRelatedField(queryset=ProductVariant.objects.select_related("product__category", "color"))
    quantity = serializers.IntegerField(min_value=1, max_value=20)


class OrderCreateSerializer(serializers.Serializer):
    """Données envoyées par le client. Aucun prix n'est accepté : ils viennent de la base."""

    first_name = serializers.CharField(max_length=80)
    last_name = serializers.CharField(max_length=80)
    phone = serializers.CharField(max_length=30)
    email = serializers.EmailField(required=False, allow_blank=True)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    zone = serializers.PrimaryKeyRelatedField(queryset=DeliveryZone.objects.filter(is_active=True), required=False, allow_null=True)
    delivery_mode = serializers.ChoiceField(choices=Order.DeliveryMode.choices, default=Order.DeliveryMode.DELIVERY)
    notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    items = OrderItemInputSerializer(many=True, allow_empty=False, max_length=30)

    def validate_first_name(self, v):
        return v.strip()

    def validate_last_name(self, v):
        return v.strip()

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if not 9 <= len(phone) <= 15:
            raise serializers.ValidationError("Numéro de téléphone invalide (9 chiffres minimum).")
        return phone

    def validate(self, attrs):
        if attrs["delivery_mode"] == Order.DeliveryMode.DELIVERY:
            if not attrs.get("zone"):
                raise serializers.ValidationError({"zone": "Choisissez votre zone de livraison."})
            if not attrs.get("address", "").strip():
                raise serializers.ValidationError({"address": "Indiquez votre adresse de livraison."})
        return attrs

    def create(self, validated):
        request = self.context.get("request")
        return services.create_order(data=validated, user=getattr(request, "user", None))


class OrderUpdateSerializer(serializers.Serializer):
    """PATCH /api/orders/{id}/ (administrateur) : changer le statut et/ou les notes internes."""

    status = serializers.ChoiceField(choices=Order.Status.choices, required=False)
    admin_notes = serializers.CharField(required=False, allow_blank=True)
    note = serializers.CharField(required=False, allow_blank=True, max_length=200, help_text="Commentaire ajouté à l'historique du statut.")

    def update(self, order, validated):
        request = self.context["request"]
        # Le statut est traité en premier : si la transition est refusée (ValidationError),
        # aucune note n'est enregistrée à côté — la requête échoue entièrement.
        if "status" in validated:
            order = services.change_status(order, validated["status"], by=request.user, note=validated.get("note", ""))
        if "admin_notes" in validated:
            order.admin_notes = validated["admin_notes"]
            order.save(update_fields=["admin_notes", "updated_at"])
        return order


class CustomerSerializer(serializers.Serializer):
    phone = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    orders_count = serializers.IntegerField()
    total_spent = serializers.IntegerField()
    last_order_at = serializers.DateTimeField()
