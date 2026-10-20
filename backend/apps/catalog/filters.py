import django_filters as df
from django.db.models import Exists, OuterRef, Q

from .models import Product, ProductVariant

ORDERINGS = {"popular": "-popularity", "newest": "-created_at", "price_asc": "price", "price_desc": "-price"}


class ProductFilter(df.FilterSet):
    """?category=slug|id &price_min= &price_max= &color=Marron &size=40 &in_stock=true &search= &ordering=popular|newest|price_asc|price_desc"""

    category = df.CharFilter(method="filter_category")
    price_min = df.NumberFilter(field_name="price", lookup_expr="gte")
    price_max = df.NumberFilter(field_name="price", lookup_expr="lte")
    color = df.CharFilter(method="filter_color")
    size = df.NumberFilter(method="filter_size")
    in_stock = df.BooleanFilter(method="filter_in_stock")
    featured = df.BooleanFilter(field_name="is_featured")
    is_active = df.BooleanFilter(field_name="is_active")  # utile à l'administrateur
    search = df.CharFilter(method="filter_search")
    ordering = df.CharFilter(method="filter_ordering")

    class Meta:
        model = Product
        fields = []

    def filter_category(self, qs, name, value):
        return qs.filter(category_id=int(value)) if value.isdigit() else qs.filter(category__slug=value)

    def filter_color(self, qs, name, value):
        return qs.filter(Exists(ProductVariant.objects.filter(product=OuterRef("pk"), color__name__iexact=value)))

    def filter_size(self, qs, name, value):
        """Produits ayant cette pointure encore en stock."""
        return qs.filter(Exists(ProductVariant.objects.filter(product=OuterRef("pk"), size=value, stock__gt=0)))

    def filter_in_stock(self, qs, name, value):
        return qs.filter(total_stock__gt=0) if value else qs.filter(total_stock=0)

    def filter_search(self, qs, name, value):
        value = value.strip()
        if not value:
            return qs
        color_match = Exists(ProductVariant.objects.filter(product=OuterRef("pk"), color__name__icontains=value))
        return qs.filter(Q(name__icontains=value) | Q(description__icontains=value) | Q(category__name__icontains=value) | color_match)

    def filter_ordering(self, qs, name, value):
        return qs.order_by(ORDERINGS.get(value, "-popularity"), "-id")
