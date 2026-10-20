from datetime import timedelta

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import OuterRef, Subquery, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.core.models import TimeStampedModel
from apps.core.utils import unique_slug
from apps.core.validators import validate_image_size


class Category(TimeStampedModel):
    name = models.CharField("nom", max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField("description", blank=True)
    image = models.ImageField("image", upload_to="categories/", blank=True, null=True, validators=[validate_image_size])
    is_active = models.BooleanField("active", default=True)
    position = models.PositiveSmallIntegerField("ordre d'affichage", default=0)

    class Meta:
        ordering = ["position", "name"]
        verbose_name = "catégorie"
        verbose_name_plural = "catégories"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name)
        super().save(*args, **kwargs)


class Color(models.Model):
    name = models.CharField("nom", max_length=40, unique=True)
    hex_code = models.CharField(
        "code couleur", max_length=7, default="#7a4a2a",
        validators=[RegexValidator(r"^#[0-9a-fA-F]{6}$", "Format attendu : #RRGGBB.")],
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "couleur"
        verbose_name_plural = "couleurs"

    def __str__(self):
        return self.name


class ProductQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True, category__is_active=True)

    def with_stock(self):
        """Ajoute `total_stock` via une sous-requête (évite de fausser les jointures)."""
        sub = (ProductVariant.objects.filter(product=OuterRef("pk")).values("product")
               .annotate(t=Sum("stock")).values("t"))
        return self.annotate(total_stock=Coalesce(Subquery(sub), 0))


class Product(TimeStampedModel):
    name = models.CharField("nom", max_length=160)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products", verbose_name="catégorie")
    description = models.TextField("description", blank=True)
    material = models.CharField("matière", max_length=200, blank=True, default="Cuir de vache véritable")
    price = models.PositiveIntegerField("prix (FCFA)", validators=[MinValueValidator(1)])
    old_price = models.PositiveIntegerField("ancien prix (FCFA)", null=True, blank=True)
    is_active = models.BooleanField("actif", default=True)
    is_featured = models.BooleanField("produit vedette", default=False)
    popularity = models.PositiveIntegerField("popularité", default=0, help_text="Plus la valeur est haute, plus le produit est mis en avant.")

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ["-popularity", "-created_at"]
        verbose_name = "produit"
        verbose_name_plural = "produits"
        indexes = [models.Index(fields=["is_active", "-popularity"]), models.Index(fields=["price"])]

    def __str__(self):
        return self.name

    def clean(self):
        if self.old_price is not None and self.price is not None and self.old_price <= self.price:
            raise ValidationError({"old_price": "L'ancien prix doit être supérieur au prix actuel."})

    def save(self, *args, **kwargs):
        if not self.slug:  # le slug ne change plus ensuite (URL stable pour le SEO)
            self.slug = unique_slug(self, self.name)
        super().save(*args, **kwargs)

    @property
    def discount_percent(self):
        if self.old_price and self.old_price > self.price:
            return round((1 - self.price / self.old_price) * 100)
        return 0

    @property
    def is_new(self):
        return self.created_at >= timezone.now() - timedelta(days=30)


class ProductVariant(models.Model):
    """Une variante = une taille + une couleur d'un produit, avec son propre stock."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants", verbose_name="produit")
    color = models.ForeignKey(Color, on_delete=models.PROTECT, related_name="variants", verbose_name="couleur")
    size = models.PositiveSmallIntegerField("taille", validators=[MinValueValidator(20), MaxValueValidator(60)])
    stock = models.PositiveIntegerField("stock", default=0)

    class Meta:
        ordering = ["color__name", "size"]
        verbose_name = "variante"
        verbose_name_plural = "variantes (taille / couleur / stock)"
        constraints = [models.UniqueConstraint(fields=["product", "color", "size"], name="unique_variant_per_product")]

    def __str__(self):
        return f"{self.product.name} - {self.color.name} - T.{self.size}"

    @property
    def in_stock(self):
        return self.stock > 0


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images", verbose_name="produit")
    color = models.ForeignKey(Color, on_delete=models.SET_NULL, null=True, blank=True, related_name="+", verbose_name="couleur illustrée")
    image = models.ImageField("image", upload_to="products/%Y/%m/", validators=[validate_image_size])
    alt_text = models.CharField("texte alternatif", max_length=200, blank=True)
    is_main = models.BooleanField("image principale", default=False)
    position = models.PositiveSmallIntegerField("ordre", default=0)

    class Meta:
        ordering = ["-is_main", "position", "id"]
        verbose_name = "image"
        verbose_name_plural = "images"

    def __str__(self):
        return f"Image de {self.product.name}"

    def save(self, *args, **kwargs):
        if not self.alt_text:
            self.alt_text = self.product.name
        if not self.pk and not self.product.images.exists():
            self.is_main = True
        super().save(*args, **kwargs)
        if self.is_main:  # une seule image principale par produit
            self.product.images.exclude(pk=self.pk).update(is_main=False)
