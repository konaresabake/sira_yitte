from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.accounts import views as acc
from apps.catalog import views as cat
from apps.core import views as core
from apps.orders import views as orders

router = DefaultRouter()
router.register("products", cat.ProductViewSet, basename="product")
router.register("product-images", cat.ProductImageViewSet, basename="product-image")
router.register("categories", cat.CategoryViewSet, basename="category")
router.register("colors", cat.ColorViewSet, basename="color")
router.register("variants", cat.VariantViewSet, basename="variant")
router.register("orders", orders.OrderViewSet, basename="order")
router.register("delivery-zones", orders.DeliveryZoneViewSet, basename="delivery-zone")

urlpatterns = [
    path("auth/register/", acc.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", acc.LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", acc.RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", acc.LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", acc.MeView.as_view(), name="auth-me"),
    path("shop/", core.ShopSettingsView.as_view(), name="shop"),
    path("health/", core.HealthView.as_view(), name="health"),
    path("customers/", orders.CustomerListView.as_view(), name="customers"),
    path("dashboard/", orders.DashboardView.as_view(), name="dashboard"),
] + router.urls
