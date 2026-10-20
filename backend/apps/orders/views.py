from datetime import timedelta

from django.db.models import Count, F, Max, Q, Sum
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.catalog.models import ProductVariant
from apps.core.models import ShopSettings
from apps.core.permissions import IsAdmin, IsAdminOrReadOnly
from apps.core.utils import normalize_phone

from . import services
from .filters import OrderFilter
from .models import DeliveryZone, Order, OrderItem
from .serializers import (
    CustomerSerializer, DeliveryZoneSerializer, OrderCreateSerializer, OrderPublicSerializer, OrderSerializer,
    OrderUpdateSerializer,
)


class DeliveryZoneViewSet(viewsets.ModelViewSet):
    """Zones et frais de livraison : lecture publique (zones actives), écriture administrateur."""

    serializer_class = DeliveryZoneSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        qs = DeliveryZone.objects.all()
        user = self.request.user
        return qs if user.is_authenticated and user.is_staff else qs.filter(is_active=True)


class OrderViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                   mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """
    - POST   /api/orders/            : passer commande (sans compte). Limité à 20/heure par IP.
    - GET    /api/orders/            : administrateur = toutes les commandes ; client connecté = ses commandes.
    - GET    /api/orders/{id}/       : détail (propriétaire ou administrateur).
    - PATCH  /api/orders/{id}/       : administrateur - statut, notes internes.
    - POST   /api/orders/{id}/cancel/: annulation (propriétaire tant que la commande est « Nouvelle », ou administrateur).
    - GET    /api/orders/track/?number=...&phone=... : suivi public sans compte.
    """

    filterset_class = OrderFilter
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "track"):
            return [AllowAny()]
        if self.action == "partial_update":
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_throttles(self):
        if self.action in ("create", "track"):
            self.throttle_scope = "orders" if self.action == "create" else "track"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = Order.objects.select_related("zone").prefetch_related("items", "events")
        user = self.request.user
        if user.is_authenticated and user.is_staff:
            return qs
        return qs.filter(user=user) if user.is_authenticated else qs.none()

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        if self.action == "partial_update":
            return OrderUpdateSerializer
        return OrderSerializer

    @extend_schema(request=OrderCreateSerializer, responses={201: OrderSerializer})
    def create(self, request, *args, **kwargs):
        ser = OrderCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        order = ser.save()
        order = self.get_object_for_response(order.pk)
        return Response(OrderSerializer(order, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @staticmethod
    def get_object_for_response(pk):
        return Order.objects.select_related("zone").prefetch_related("items", "events").get(pk=pk)

    @extend_schema(request=OrderUpdateSerializer, responses=OrderSerializer)
    def partial_update(self, request, *args, **kwargs):
        order = self.get_object()
        ser = OrderUpdateSerializer(order, data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        order = ser.save()
        return Response(OrderSerializer(self.get_object_for_response(order.pk), context={"request": request}).data)

    @extend_schema(request=None, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if not request.user.is_staff and order.status != Order.Status.NEW:
            return Response({"detail": "Cette commande est déjà en cours de traitement : contactez la boutique pour l'annuler."},
                            status=status.HTTP_400_BAD_REQUEST)
        order = services.change_status(order, Order.Status.CANCELLED, by=request.user, note="Annulée par " + ("l'administrateur" if request.user.is_staff else "le client"))
        return Response(OrderSerializer(self.get_object_for_response(order.pk), context={"request": request}).data)

    @extend_schema(
        parameters=[OpenApiParameter("number", str, required=True), OpenApiParameter("phone", str, required=True)],
        responses=OrderPublicSerializer,
    )
    @action(detail=False, methods=["get"], filterset_class=None)
    def track(self, request):
        number = request.query_params.get("number", "").strip().upper()
        phone = normalize_phone(request.query_params.get("phone", ""))
        if not number or len(phone) < 9:
            return Response({"detail": "Indiquez le numéro de commande et le téléphone."}, status=status.HTTP_400_BAD_REQUEST)
        order = get_object_or_404(Order.objects.prefetch_related("items"), number=number, phone=phone)
        return Response(OrderPublicSerializer(order).data)


@extend_schema(responses=CustomerSerializer(many=True))
class CustomerListView(generics.ListAPIView):
    """Clients ayant commandé (regroupés par téléphone) : administrateur."""

    permission_classes = [IsAdmin]
    serializer_class = CustomerSerializer

    def get_queryset(self):
        qs = (Order.objects.values("phone").annotate(
            first_name=Max("first_name"), last_name=Max("last_name"), orders_count=Count("id"),
            total_spent=Sum("total", filter=~Q(status=Order.Status.CANCELLED), default=0), last_order_at=Max("created_at"),
        ).order_by("-total_spent", "-last_order_at"))
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(first_name__icontains=search) | Q(last_name__icontains=search) | Q(phone__contains=normalize_phone(search) or "!"))
        return qs


class DashboardView(APIView):
    """GET /api/dashboard/ : chiffres clés du tableau de bord administrateur."""

    permission_classes = [IsAdmin]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        from apps.catalog.models import Product

        orders = Order.objects.all()
        valid = orders.exclude(status=Order.Status.CANCELLED)
        today = timezone.localdate()
        start = today - timedelta(days=6)
        daily = {r["d"]: r for r in valid.filter(created_at__date__gte=start).annotate(d=TruncDate("created_at"))
                 .values("d").annotate(revenue=Sum("total"), orders=Count("id"))}
        sales = []
        for i in range(7):
            d = start + timedelta(days=i)
            sales.append({"date": d.isoformat(), "revenue": daily.get(d, {}).get("revenue", 0), "orders": daily.get(d, {}).get("orders", 0)})

        threshold = ShopSettings.load().low_stock_threshold
        low = ProductVariant.objects.filter(stock__lte=threshold, product__is_active=True).select_related("product", "color").order_by("stock", "product__name")[:10]
        products = Product.objects.with_stock()
        by_status = {s.value: 0 for s in Order.Status}
        by_status.update({r["status"]: r["n"] for r in orders.values("status").annotate(n=Count("id"))})
        top = (OrderItem.objects.filter(product__isnull=False).exclude(order__status=Order.Status.CANCELLED)
               .values("product_id", "product_name").annotate(sold=Sum("quantity"), revenue=Sum(F("quantity") * F("unit_price")))
               .order_by("-sold")[:5])
        return Response({
            "orders_count": orders.count(),
            "revenue": valid.aggregate(t=Sum("total", default=0))["t"],
            "new_orders": orders.filter(status=Order.Status.NEW).count(),
            "products_count": products.count(),
            "active_products": products.filter(is_active=True).count(),
            "out_of_stock_products": products.filter(total_stock=0).count(),
            "orders_by_status": by_status,
            "sales_last_7_days": sales,
            "recent_orders": OrderSerializer(orders.select_related("zone").prefetch_related("items", "events")[:5], many=True, context={"request": request}).data,
            "low_stock": [{"variant": v.pk, "product": v.product.name, "color": v.color.name, "size": v.size, "stock": v.stock} for v in low],
            "top_products": [{"product_id": t["product_id"], "product_name": t["product_name"], "quantity": t["sold"], "revenue": t["revenue"]} for t in top],
        })
