from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ShopSettings
from .permissions import IsAdminOrReadOnly
from .serializers import AdminShopSerializer, PublicShopSerializer


class ShopSettingsView(APIView):
    """GET public : coordonnées et WhatsApp de la boutique. PATCH/PUT : administrateur."""

    permission_classes = [IsAdminOrReadOnly]

    def get_serializer_class(self):
        user = self.request.user
        return AdminShopSerializer if user.is_authenticated and user.is_staff else PublicShopSerializer

    @extend_schema(responses=PublicShopSerializer)
    def get(self, request):
        return Response(self.get_serializer_class()(ShopSettings.load()).data)

    @extend_schema(request=AdminShopSerializer, responses=AdminShopSerializer)
    def patch(self, request):
        ser = AdminShopSerializer(ShopSettings.load(), data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    put = patch


@extend_schema(responses={200: {"type": "object", "properties": {"status": {"type": "string"}}}})
class HealthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        return Response({"status": "ok"})
