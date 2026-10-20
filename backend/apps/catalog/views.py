from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.permissions import IsAdmin, IsAdminOrReadOnly

from .filters import ProductFilter
from .models import Category, Color, Product, ProductImage, ProductVariant
from .serializers import (
    CategorySerializer, ColorSerializer, ProductDetailSerializer, ProductImageSerializer, ProductListSerializer,
    ProductWriteSerializer, VariantSerializer, VariantWriteSerializer,
)


class IdOrSlugMixin:
    """Permet /api/<ressource>/12/ (spécification) ET /api/<ressource>/mon-slug/ (URLs propres, SEO)."""

    lookup_value_regex = "[^/.]+"

    def get_object(self):
        lookup = self.kwargs[self.lookup_url_kwarg or self.lookup_field]
        qs = self.get_queryset()
        obj = get_object_or_404(qs, pk=int(lookup)) if lookup.isdigit() else get_object_or_404(qs, slug=lookup)
        self.check_object_permissions(self.request, obj)
        return obj


def _is_admin(request):
    return bool(request.user and request.user.is_authenticated and request.user.is_staff)


@extend_schema_view(
    list=extend_schema(parameters=[
        OpenApiParameter("category", str, description="Slug ou identifiant de catégorie"),
        OpenApiParameter("price_min", int), OpenApiParameter("price_max", int),
        OpenApiParameter("color", str, description="Nom de couleur (ex. Marron)"),
        OpenApiParameter("size", int, description="Pointure encore disponible"),
        OpenApiParameter("in_stock", bool), OpenApiParameter("featured", bool),
        OpenApiParameter("search", str, description="Recherche dans le nom, la description, la catégorie et les couleurs"),
        OpenApiParameter("ordering", str, enum=["popular", "newest", "price_asc", "price_desc"]),
    ]),
)
class ProductViewSet(IdOrSlugMixin, viewsets.ModelViewSet):
    """Catalogue. Lecture publique (produits actifs) ; création, modification et suppression : administrateur."""

    permission_classes = [IsAdminOrReadOnly]
    filterset_class = ProductFilter
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = (Product.objects.select_related("category").with_stock().prefetch_related(
            Prefetch("variants", queryset=ProductVariant.objects.select_related("color").order_by("color__name", "size")),
            Prefetch("images", queryset=ProductImage.objects.select_related("color").order_by("-is_main", "position", "id")),
        ))
        return qs if _is_admin(self.request) else qs.active()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ProductWriteSerializer
        return ProductDetailSerializer if self.action == "retrieve" else ProductListSerializer

    @extend_schema(responses=ProductListSerializer(many=True))
    @action(detail=False, methods=["get"])
    def featured(self, request):
        """Produits vedettes (page d'accueil), triés par popularité."""
        qs = self.get_queryset().filter(is_featured=True, is_active=True)[:8]
        return Response(ProductListSerializer(qs, many=True, context={"request": request}).data)

    @extend_schema(request={"multipart/form-data": ProductImageSerializer}, responses={201: ProductImageSerializer})
    @action(detail=True, methods=["post"], permission_classes=[IsAdmin], parser_classes=[MultiPartParser, FormParser])
    def images(self, request, pk=None, *args, **kwargs):
        """Ajoute une image au produit (compressée en WebP, 5 Mo max)."""
        product = self.get_object()
        ser = ProductImageSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save(product=product)
        return Response(ser.data, status=status.HTTP_201_CREATED)


class ProductImageViewSet(mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Modifier (texte alternatif, image principale, ordre) ou supprimer une image de produit."""

    queryset = ProductImage.objects.select_related("product", "color")
    serializer_class = ProductImageSerializer
    permission_classes = [IsAdmin]
    http_method_names = ["patch", "delete", "options"]


class CategoryViewSet(IdOrSlugMixin, viewsets.ModelViewSet):
    """Catégories : lecture publique, écriture administrateur. Supprimer une catégorie utilisée renvoie 409."""

    permission_classes = [IsAdminOrReadOnly]
    serializer_class = CategorySerializer
    pagination_class = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = Category.objects.annotate(products_count=Count("products", filter=Q(products__is_active=True), distinct=True))
        return qs if _is_admin(self.request) else qs.filter(is_active=True)


class ColorViewSet(viewsets.ModelViewSet):
    queryset = Color.objects.all()
    serializer_class = ColorSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None


class VariantViewSet(viewsets.ModelViewSet):
    """Variantes (taille + couleur + stock) : administrateur. Idéal pour ajuster un stock avec PATCH {"stock": 5}."""

    queryset = ProductVariant.objects.select_related("product", "color")
    permission_classes = [IsAdmin]
    filterset_fields = ["product", "color", "size"]

    def get_serializer_class(self):
        return VariantSerializer if self.action in ("list", "retrieve") else VariantWriteSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(VariantSerializer(obj).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        ser = self.get_serializer(self.get_object(), data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        return Response(VariantSerializer(ser.save()).data)

    update = partial_update
