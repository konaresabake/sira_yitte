import logging

from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """Réponses d'erreur homogènes ; un objet encore référencé renvoie 409 au lieu d'un 500."""
    if isinstance(exc, ProtectedError):
        return Response(
            {"detail": "Suppression impossible : cet élément est encore utilisé (produits, variantes...)."},
            status=status.HTTP_409_CONFLICT,
        )
    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Erreur serveur non gérée", exc_info=exc)
    return response
