from django.conf import settings
from django.db import transaction
from rest_framework import serializers

from apps.core.utils import optimize_image

from .models import Category, Color, Product, ProductImage, ProductVariant


class ImageUploadMixin:
    """Valide la taille puis compresse/redimensionne l'image envoyée (WebP)."""

    def _optimize(self, image):
        limit = settings.MAX_IMAGE_UPLOAD_MB * 1024 * 1024
        if image.size > limit:
            raise serializers.ValidationError(f"L'image dépasse {settings.MAX_IMAGE_UPLOAD_MB} Mo.")
        return optimize_image(image)


class ColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Color
        fields = ["id", "name", "hex_code"]


class CategorySerializer(ImageUploadMixin, serializers.ModelSerializer):
    products_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "image", "is_active", "position", "products_count"]
        read_only_fields = ["slug"]

    def validate_image(self, value):
        return self._optimize(value) if value else value


class ProductImageSerializer(ImageUploadMixin, serializers.ModelSerializer):
    color_name = serializers.CharField(source="color.name", read_only=True, default=None)

    class Meta:
        model = ProductImage
        fields = ["id", "image", "alt_text", "color", "color_name", "is_main", "position"]

    def validate_image(self, value):
        return self._optimize(value)


class VariantSerializer(serializers.ModelSerializer):
    """Lecture d'une variante : couleur et taille avec disponibilité."""

    color_name = serializers.CharField(source="color.name", read_only=True)
    hex_code = serializers.CharField(source="color.hex_code", read_only=True)
    in_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = ["id", "product", "color", "color_name", "hex_code", "size", "stock", "in_stock"]


class VariantWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ["id", "product", "color", "size", "stock"]

    def validate(self, attrs):
        inst = self.instance
        product = attrs.get("product", inst.product if inst else None)
        color = attrs.get("color", inst.color if inst else None)
        size = attrs.get("size", inst.size if inst else None)
        qs = ProductVariant.objects.filter(product=product, color=color, size=size)
        if inst:
            qs = qs.exclude(pk=inst.pk)
        if qs.exists():
            raise serializers.ValidationError("Cette variante (taille + couleur) existe déjà pour ce produit.")
        return attrs


class ProductListSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()
    colors = serializers.SerializerMethodField()
    sizes = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    discount_percent = serializers.IntegerField(read_only=True)
    is_new = serializers.BooleanField(read_only=True)
    total_stock = serializers.IntegerField(read_only=True)
    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "category", "price", "old_price", "discount_percent", "is_featured", "is_active",
            "is_new", "popularity", "colors", "sizes", "image", "total_stock", "in_stock",
        ]

    def get_category(self, obj) -> dict:
        return {"id": obj.category_id, "name": obj.category.name, "slug": obj.category.slug}

    def get_colors(self, obj) -> list[dict]:
        seen = {}
        for v in obj.variants.all():
            seen.setdefault(v.color_id, {"id": v.color_id, "name": v.color.name, "hex_code": v.color.hex_code})
        return list(seen.values())

    def get_sizes(self, obj) -> list[int]:
        return sorted({v.size for v in obj.variants.all()})

    def get_image(self, obj) -> str:
        images = list(obj.images.all())
        if not images:
            return None
        main = next((i for i in images if i.is_main), images[0])
        request = self.context.get("request")
        url = main.image.url
        return request.build_absolute_uri(url) if request else url

    def get_in_stock(self, obj) -> bool:
        return getattr(obj, "total_stock", 0) > 0


class ProductDetailSerializer(ProductListSerializer):
    variants = VariantSerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ["description", "material", "variants", "images", "created_at", "updated_at"]


class VariantInputSerializer(serializers.Serializer):
    color = serializers.PrimaryKeyRelatedField(queryset=Color.objects.all())
    size = serializers.IntegerField(min_value=20, max_value=60)
    stock = serializers.IntegerField(min_value=0)


class ProductWriteSerializer(serializers.ModelSerializer):
    """Création / modification d'un produit avec ses variantes (taille, couleur, stock)."""

    variants = VariantInputSerializer(many=True, required=False)

    class Meta:
        model = Product
        fields = ["id", "name", "slug", "category", "description", "material", "price", "old_price",
                  "is_active", "is_featured", "popularity", "variants"]
        read_only_fields = ["slug"]

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", None))
        old = attrs.get("old_price", getattr(self.instance, "old_price", None))
        if old is not None and price is not None and old <= price:
            raise serializers.ValidationError({"old_price": "L'ancien prix doit être supérieur au prix actuel."})
        return attrs

    def validate_variants(self, value):
        keys = [(v["color"].pk, v["size"]) for v in value]
        if len(keys) != len(set(keys)):
            raise serializers.ValidationError("Une même combinaison taille + couleur est répétée.")
        return value

    @staticmethod
    def _sync_variants(product, variants):
        keep = []
        for v in variants:
            obj, _ = ProductVariant.objects.update_or_create(
                product=product, color=v["color"], size=v["size"], defaults={"stock": v["stock"]})
            keep.append(obj.pk)
        product.variants.exclude(pk__in=keep).delete()

    @transaction.atomic
    def create(self, validated):
        variants = validated.pop("variants", [])
        product = super().create(validated)
        self._sync_variants(product, variants)
        return product

    @transaction.atomic
    def update(self, instance, validated):
        variants = validated.pop("variants", None)
        product = super().update(instance, validated)
        if variants is not None:
            self._sync_variants(product, variants)
        return product

    def to_representation(self, instance):
        instance = Product.objects.with_stock().prefetch_related("variants__color", "images").get(pk=instance.pk)
        return ProductDetailSerializer(instance, context=self.context).data
