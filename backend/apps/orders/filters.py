import django_filters as df
from django.db.models import Q

from apps.core.utils import normalize_phone

from .models import Order


class OrderFilter(df.FilterSet):
    """?status=nouvelle &zone=1 &date_from=2026-01-01 &date_to=2026-01-31 &search=CMD-2026-00012|nom|téléphone"""

    status = df.ChoiceFilter(choices=Order.Status.choices)
    date_from = df.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = df.DateFilter(field_name="created_at", lookup_expr="date__lte")
    search = df.CharFilter(method="filter_search")

    class Meta:
        model = Order
        fields = ["status", "zone", "delivery_mode"]

    def filter_search(self, qs, name, value):
        value = value.strip()
        phone = normalize_phone(value)
        q = Q(number__icontains=value) | Q(first_name__icontains=value) | Q(last_name__icontains=value)
        if len(phone) >= 4:
            q |= Q(phone__contains=phone)
        return qs.filter(q)
