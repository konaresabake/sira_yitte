from django.core.validators import RegexValidator
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField("date de création", auto_now_add=True)
    updated_at = models.DateTimeField("dernière modification", auto_now=True)

    class Meta:
        abstract = True


class ShopSettings(models.Model):
    """Réglages de la boutique (une seule ligne). Modifiables par l'administrateur."""

    shop_name = models.CharField("nom de la boutique", max_length=120, default="Sira Yitte")
    tagline = models.CharField("slogan", max_length=200, blank=True, default="Une caresse de cuir, un voyage de confort.")
    whatsapp_number = models.CharField(
        "numéro WhatsApp", max_length=15, default="221775857358",
        validators=[RegexValidator(r"^\d{9,15}$", "Chiffres uniquement, format international sans « + » (ex. 221775857358).")],
    )
    email = models.EmailField("e-mail de la boutique", blank=True, help_text="Reçoit les notifications de nouvelles commandes.")
    phone = models.CharField("téléphone", max_length=30, blank=True)
    address = models.CharField("adresse", max_length=255, blank=True, default="Dakar, Sénégal")
    opening_hours = models.CharField("horaires", max_length=160, blank=True, default="Lundi au samedi, 9h à 19h")
    low_stock_threshold = models.PositiveSmallIntegerField("seuil d'alerte de stock", default=2)

    class Meta:
        verbose_name = "réglages de la boutique"
        verbose_name_plural = "réglages de la boutique"

    def __str__(self):
        return self.shop_name

    def save(self, *args, **kwargs):
        self.pk = 1  # singleton
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Singleton : la suppression est ignorée (retour à la forme Django : nombre, dict).
        return 0, {}

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
