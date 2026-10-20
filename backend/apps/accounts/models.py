from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError("L'adresse e-mail est obligatoire.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)  # mot de passe toujours hashé
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", User.Role.ADMIN)
        return self._create(email, password, **extra)


class User(AbstractUser):
    """Utilisateur identifié par e-mail. `is_staff` donne accès à l'administration de la boutique."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrateur"
        CUSTOMER = "client", "Client"

    username = None
    email = models.EmailField("e-mail", unique=True)
    phone = models.CharField("téléphone", max_length=30, blank=True)
    role = models.CharField("rôle", max_length=10, choices=Role.choices, default=Role.CUSTOMER)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def save(self, *args, **kwargs):
        self.email = self.email.lower()
        if self.is_staff:
            self.role = self.Role.ADMIN
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email
