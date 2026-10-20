from django.contrib import admin

from .models import Category, Color, Product, ProductImage, ProductVariant


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "position")
    list_editable = ("is_active", "position")
    search_fields = ("name",)


@admin.register(Color)
class ColorAdmin(admin.ModelAdmin):
    list_display = ("name", "hex_code")


class VariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1


class ImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


@admin.action(description="Activer les produits sélectionnés")
def activate(modeladmin, request, queryset):
    queryset.update(is_active=True)


@admin.action(description="Désactiver les produits sélectionnés")
def deactivate(modeladmin, request, queryset):
    queryset.update(is_active=False)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "old_price", "is_active", "is_featured", "popularity", "created_at")
    list_filter = ("category", "is_active", "is_featured")
    list_editable = ("is_active", "is_featured", "popularity")
    search_fields = ("name", "description")
    prepopulated_fields = {}
    inlines = [VariantInline, ImageInline]
    actions = [activate, deactivate]


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ("product", "color", "size", "stock")
    list_filter = ("color", "product__category")
    list_editable = ("stock",)
    search_fields = ("product__name",)
