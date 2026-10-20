from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.core.utils import normalize_phone

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "phone", "role", "is_staff", "date_joined"]
        read_only_fields = ["id", "email", "role", "is_staff", "date_joined"]

    def validate_phone(self, value):
        return normalize_phone(value) if value else ""


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["email", "password", "first_name", "last_name", "phone"]

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet e-mail.")
        return value

    def validate_phone(self, value):
        return normalize_phone(value) if value else ""

    def validate(self, attrs):
        validate_password(attrs["password"], User(email=attrs.get("email", ""), first_name=attrs.get("first_name", "")))
        return attrs

    def create(self, validated):
        return User.objects.create_user(**validated)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Connexion par e-mail ; la réponse contient aussi le profil de l'utilisateur."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["is_staff"] = user.is_staff
        return token

    def validate(self, attrs):
        attrs[self.username_field] = str(attrs.get(self.username_field, "")).strip().lower()
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
