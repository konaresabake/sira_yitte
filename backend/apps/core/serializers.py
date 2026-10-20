from rest_framework import serializers

from .models import ShopSettings
from .utils import whatsapp_url


class PublicShopSerializer(serializers.ModelSerializer):
    whatsapp_url = serializers.SerializerMethodField()

    class Meta:
        model = ShopSettings
        fields = ["shop_name", "tagline", "whatsapp_number", "whatsapp_url", "email", "phone", "address", "opening_hours"]

    def get_whatsapp_url(self, obj) -> str:
        return whatsapp_url(obj.whatsapp_number)


class AdminShopSerializer(PublicShopSerializer):
    class Meta(PublicShopSerializer.Meta):
        fields = PublicShopSerializer.Meta.fields + ["low_stock_threshold"]
