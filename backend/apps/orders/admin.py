from django.contrib import admin

from .models import DeliveryZone, Order, OrderItem, OrderStatusEvent
from .services import change_status


@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.ModelAdmin):
    list_display = ("name", "fee", "is_active", "position")
    list_editable = ("fee", "is_active", "position")


class ItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ("product_name", "color_name", "size", "unit_price", "quantity")
    fields = readonly_fields

    def has_add_permission(self, request, obj=None):
        return False


class EventInline(admin.TabularInline):
    model = OrderStatusEvent
    extra = 0
    can_delete = False
    readonly_fields = ("from_status", "to_status", "changed_by", "note", "created_at")
    fields = readonly_fields

    def has_add_permission(self, request, obj=None):
        return False


def _make_action(status, label):
    @admin.action(description=f"Passer en « {label} »")
    def action(modeladmin, request, queryset):
        done = 0
        for order in queryset:
            try:
                change_status(order, status, by=request.user, note="Action groupée")
                done += 1
            except Exception:  # noqa: BLE001
                modeladmin.message_user(request, f"{order.number} : transition impossible.", level="warning")
        modeladmin.message_user(request, f"{done} commande(s) mise(s) à jour.")
    action.__name__ = f"set_{status}"
    return action


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("number", "customer_name", "phone", "zone_name", "total", "status", "created_at")
    list_filter = ("status", "delivery_mode", "zone", "created_at")
    search_fields = ("number", "first_name", "last_name", "phone")
    readonly_fields = ("number", "user", "subtotal", "delivery_fee", "delivery_fee_to_confirm", "total", "status", "stock_restored", "created_at", "updated_at")
    inlines = [ItemInline, EventInline]
    date_hierarchy = "created_at"
    actions = [_make_action(s.value, s.label) for s in Order.Status]
