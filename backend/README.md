# Sira Yitte - Backend (Django REST Framework)

*Une caresse de cuir, un voyage de confort.*

API REST de la boutique de sandales en cuir : catalogue, variantes (taille + couleur + stock), commandes sans compte, zones de livraison, administration, notifications. Conforme au cahier des charges : **Django + DRF + PostgreSQL + JWT**.

## Démarrage

Voir le `README.md` à la racine du projet : installation de PostgreSQL sous Windows, configuration de `.env`, migrations, données de démonstration et déploiement sur Render.

Commandes utiles : `python manage.py migrate` · `python manage.py seed_demo --orders 14` (catalogue de démo) · `python manage.py bootstrap` (initialisation de production, idempotente) · `python manage.py test` (64 tests) · documentation interactive de l'API : `/api/docs/` · administration Django : `/django-admin/`.

## Modèle de données

| Modèle | Champs principaux |
| --- | --- |
| `User` (accounts) | email (identifiant), prénom, nom, téléphone, rôle (`admin` / `client`), mot de passe hashé |
| `Category` | nom, slug, description, image, active, ordre |
| `Color` | nom, code hexadécimal |
| `Product` | nom, slug, catégorie, description, matière, prix, ancien prix, actif, vedette, popularité, dates |
| `ProductVariant` | produit, **taille, couleur, stock** (unique par produit + couleur + taille) |
| `ProductImage` | produit, couleur, image (WebP optimisée), texte alternatif, image principale, ordre |
| `DeliveryZone` | nom, frais (vide = « À confirmer »), active |
| `Order` | numéro `CMD-2026-00015`, client, téléphone, adresse, zone, mode, frais, sous-total, total, statut, notes |
| `OrderItem` | copie du produit, couleur, taille, prix unitaire, quantité (l'historique ne change jamais) |
| `OrderStatusEvent` | historique des changements de statut |
| `ShopSettings` | nom, WhatsApp (+221 77 585 73 58), e-mail, horaires, seuil d'alerte de stock |

## Endpoints

Lecture publique : **P**. Réservé à l'administrateur : **A**. Utilisateur connecté : **C**.

| Méthode | URL | Accès | Rôle |
| --- | --- | --- | --- |
| POST | `/api/auth/register/` | P | Créer un compte client (reçoit les jetons) |
| POST | `/api/auth/login/` | P | Connexion e-mail + mot de passe -> `access`, `refresh`, `user` |
| POST | `/api/auth/refresh/` | P | Renouveler le jeton d'accès |
| POST | `/api/auth/logout/` | P | Invalider le jeton de rafraîchissement |
| GET/PATCH | `/api/auth/me/` | C | Profil |
| GET | `/api/products/` | P | Catalogue paginé et filtré (voir ci-dessous) |
| GET | `/api/products/{id ou slug}/` | P | Détail avec variantes, stocks et images |
| GET | `/api/products/featured/` | P | Produits vedettes |
| POST/PUT/PATCH/DELETE | `/api/products/` et `/{id}/` | A | Créer, modifier (variantes incluses), supprimer |
| POST | `/api/products/{id}/images/` | A | Envoyer une image (multipart, 5 Mo max, compressée en WebP) |
| PATCH/DELETE | `/api/product-images/{id}/` | A | Texte alternatif, image principale, ordre / suppression |
| GET | `/api/categories/` | P | Catégories actives avec nombre de produits |
| POST/PUT/PATCH/DELETE | `/api/categories/{id}/` | A | Gérer les catégories (suppression d'une catégorie utilisée : 409) |
| GET / POST... | `/api/colors/` | P / A | Couleurs |
| GET/POST/PATCH/DELETE | `/api/variants/` | A | Variantes ; ajuster un stock : `PATCH {"stock": 7}` |
| GET | `/api/delivery-zones/` | P | Zones et frais de livraison |
| POST/PUT/PATCH/DELETE | `/api/delivery-zones/{id}/` | A | Modifier les frais |
| **POST** | `/api/orders/` | **P** | **Passer commande (sans compte)** |
| GET | `/api/orders/` | A / C | Toutes les commandes (A) ou les siennes (C) ; filtres `status`, `zone`, `date_from`, `date_to`, `search` |
| GET | `/api/orders/{id}/` | A / C | Détail |
| PATCH | `/api/orders/{id}/` | A | `{"status": "confirmee", "admin_notes": "...", "note": "..."}` |
| POST | `/api/orders/{id}/cancel/` | A / C | Annuler (le client : seulement tant que « Nouvelle ») |
| GET | `/api/orders/track/?number=CMD-2026-00015&phone=77...` | P | Suivi sans compte, sans donnée personnelle |
| GET | `/api/customers/` | A | Clients regroupés par téléphone (commandes, total dépensé) |
| GET | `/api/dashboard/` | A | Chiffres clés, ventes sur 7 jours, statuts, alertes de stock, meilleures ventes |
| GET/PATCH | `/api/shop/` | P / A | Coordonnées et numéro WhatsApp |
| GET | `/api/health/` | P | Contrôle de santé |

### Filtres du catalogue

`/api/products/?category=homme&price_min=10000&price_max=20000&color=Marron&size=42&in_stock=true&search=cuir&ordering=popular&page=2&page_size=12`

`ordering` : `popular`, `newest`, `price_asc`, `price_desc`. `category` accepte un slug ou un identifiant. `size` ne retient que les produits dont cette pointure est encore en stock.

### Exemple : passer une commande

```http
POST /api/orders/
{
  "first_name": "Awa", "last_name": "Diop", "phone": "77 412 08 15",
  "address": "Rue 10, Pikine", "zone": 2, "delivery_mode": "livraison",
  "items": [{"variant": 41, "quantity": 2}]
}
```

Réponse `201` : numéro, statut, lignes, frais, total, et `whatsapp_url` (lien prérempli vers la boutique). **Aucun prix n'est lu dans la requête** : le serveur utilise les prix de la base.

## Règles métier

- **Stock** : une variante à 0 est en « rupture de stock » et ne peut pas être commandée. La commande est atomique : si une seule ligne manque de stock, rien n'est enregistré. Le stock est verrouillé puis décrémenté dans la même transaction (pas de survente).
- **Annulation** : une commande annulée restitue son stock, une seule fois.
- **Statuts** : Nouvelle → Confirmée → En préparation → Expédiée → Livrée, ou Annulée tant que la commande n'est pas livrée. Retour en arrière impossible. Chaque changement est historisé.
- **Livraison** : frais selon la zone ; zone sans tarif = « À confirmer » (`delivery_fee_to_confirm`) ; retrait en boutique = 0.
- **Historique intact** : une ligne de commande conserve nom, couleur, taille et prix d'origine, même si le produit change ou est supprimé.
- **Téléphones** normalisés (`+221 77 412 08 15` devient `774120815`).
- **Notifications** : à chaque commande, e-mail au vendeur (si `ShopSettings.email` est renseigné) et confirmation au client (s'il a donné son e-mail) ; e-mail au client à chaque changement de statut. En développement, les e-mails s'affichent dans la console. Une panne d'envoi ne bloque jamais une commande. Le lien WhatsApp fourni permet une notification par WhatsApp.

## Sécurité (section 23 du cahier des charges)

- Mots de passe hashés, validateurs de mot de passe, jetons JWT (30 min) avec rotation et liste noire des jetons de rafraîchissement (7 jours).
- Permissions par action : un client ne peut jamais accéder aux routes d'administration (401 / 403 testés).
- Validation de toutes les entrées ; prix et totaux jamais lus du client ; limitation de débit (login 10/min, commandes 20/h, suivi 30/h, inscription 10/h).
- Images : taille limitée à 5 Mo, vérifiées par Pillow, recompressées en WebP (1600 px max), texte alternatif obligatoire par défaut.
- CORS limité au frontend (`CORS_ALLOWED_ORIGINS`), HTTPS, HSTS et cookies sécurisés activés hors `DEBUG`, `SECRET_KEY` obligatoire en production, tout secret dans `.env`.
- `python manage.py check --deploy` ne signale aucun problème.

## Frontend React

Le dossier `../frontend` est déjà branché sur cette API (client `src/services/api.js`). Correspondance :

| Action du frontend | Appel |
| --- | --- |
| Catalogue, filtres, tri, pagination | `GET /products/?category=&price_max=&size=&color=&in_stock=&search=&ordering=&page=` |
| Fiche produit | `GET /products/{slug}/` (variantes avec `id`, `stock`, `hex_code`) |
| Zones, catégories, couleurs, WhatsApp | `GET /delivery-zones/`, `/categories/`, `/colors/`, `/shop/` |
| Valider la commande | `POST /orders/` avec les `id` de variantes du panier |
| Suivi de commande | `GET /orders/track/?number=&phone=` |
| Connexion admin | `POST /auth/login/` puis `Authorization: Bearer <access>` ; renouvellement `POST /auth/refresh/` |
| Tableau de bord, clients | `GET /dashboard/`, `GET /customers/` |
| Produits, stocks, catégories | `/products/`, `/variants/{id}/`, `/categories/`, `/product-images/{id}/` |
| Commandes admin | `GET /orders/`, `PATCH /orders/{id}/` |

En développement, le frontend appelle `/api` et Vite redirige vers Django ; en production, `VITE_API_URL` (Vercel) pointe vers l'API Render et `CORS_ALLOWED_ORIGINS` (Render) doit contenir l'adresse du site.

## Structure

```
config/          settings, urls, api_urls (routeur)
apps/core/       réglages boutique, permissions, pagination, utilitaires, commande seed_demo
apps/accounts/   utilisateur par e-mail, inscription, JWT, profil
apps/catalog/    catégories, couleurs, produits, variantes, images, filtres
apps/orders/     zones, commandes, services (stock, statuts), notifications, tableau de bord
seed_assets/     photos des deux sandales de démonstration
```

## Déploiement (Render)

Voir `../render.yaml` et le `README.md` à la racine. Au build, `python manage.py bootstrap` applique les migrations, crée les catégories, couleurs, zones et réglages manquants (sans jamais écraser vos modifications) et le compte administrateur (`DJANGO_SUPERUSER_EMAIL` / `DJANGO_SUPERUSER_PASSWORD`). Les photos sont envoyées sur Cloudinary quand `CLOUDINARY_URL` est défini.

## Limites de cette version (MVP)

Pas de paiement en ligne, de SMS ni de WhatsApp automatique (seulement le lien prérempli), et les statistiques avancées (version 2) se limitent au tableau de bord et aux meilleures ventes.
