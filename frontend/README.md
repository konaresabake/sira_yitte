# Sira Yitte - Frontend (React)

*Une caresse de cuir, un voyage de confort.*

Boutique en ligne et tableau de bord administrateur, **branchés sur l'API Django** du dossier `../backend` : catalogue, stocks, commandes et authentification JWT viennent tous du serveur (plus aucune donnée locale, hormis le panier).

## Démarrer

Prérequis : Node.js 18 ou plus récent, et le backend lancé (`../backend`, port 8000 ; voir le `README.md` à la racine).

```bash
npm install
npm run dev          # http://localhost:5173
```

En développement, Vite redirige `/api` et `/media` vers Django (`http://127.0.0.1:8000`), donc aucun réglage CORS. Autre serveur : `VITE_PROXY_TARGET=https://api.exemple.com npm run dev`.

Compte administrateur de démonstration (après `python manage.py seed_demo` côté backend) : `admin@sirayitte.sn` / `admin123`, sur `/admin`.

## Configuration

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `VITE_API_URL` | URL de l'API. En production sur un autre domaine : `https://api.sirayitte.sn/api` (ajoutez le domaine du site dans `CORS_ALLOWED_ORIGINS` côté Django) | `/api` |
| `VITE_PROXY_TARGET` | Cible du proxy de développement | `http://127.0.0.1:8000` |

## Fonctionnement

- **`src/services/api.js`** : unique point d'accès à l'API. Jetons JWT en `sessionStorage`, renouvellement automatique du jeton expiré (une seule tentative, partagée), erreurs normalisées en `ApiError` avec messages en français (`error.fields` pour les erreurs par champ).
- **Contextes** : `ShopContext` (réglages WhatsApp, zones de livraison, catégories), `CartContext` (panier par variante, stocké dans le navigateur), `AuthContext` (session administrateur), `ToastContext`.
- **Panier** : chaque ligne désigne une *variante* précise (taille + couleur). À l'ouverture du panier et de la commande, prix et stocks sont revérifiés auprès de l'API ; un article devenu indisponible est retiré avec un message. À la validation, seuls les identifiants de variantes et les quantités sont envoyés : **le serveur recalcule prix, livraison et total**.
- **Catalogue** : filtres, tri et pagination exécutés par l'API et conservés dans l'URL (`/catalogue?category=homme&size=42&sort=price_asc`), recherche avec courte pause pour limiter les requêtes.
- **États** : chargement (squelettes), erreur avec bouton « Réessayer », bannière si le serveur est injoignable.
- **Images** : vraie photo si le produit en a une dans l'API, sinon illustration SVG de repli.
- **Administration** (`/admin/*`, routes protégées) : tableau de bord, produits (variantes, images, vedette, actif), catégories, stocks (enregistrés à chaque modification), commandes (seules les transitions de statut autorisées sont proposées, notes internes, historique), clients, zones de livraison et coordonnées de la boutique.

## Pages

| Route | Page |
| --- | --- |
| `/` · `/catalogue` · `/sandales/:slug` | Accueil, catalogue, fiche produit |
| `/panier` · `/commande` · `/confirmation/:numero` | Panier, commande, confirmation |
| `/suivi` | Suivi d'une commande (numéro + téléphone, sans compte) |
| `/contact` | Contact (WhatsApp) |
| `/admin` | Connexion administrateur |
| `/admin/dashboard` `produits` `categories` `stocks` `commandes` `clients` `livraison` | Back-office |

## Tests

```bash
npm test                 # 29 tests d'interface (Vitest + Testing Library)
npm run test:integration # 16 tests du client API contre un VRAI backend lancé
npm run fixtures         # ré-enregistre de vraies réponses de l'API dans src/test/fixtures/
```

- Les tests d'interface simulent `fetch` avec des **réponses réelles de l'API** (fixtures capturées sur le backend) : parcours d'achat complet (fiche, panier, commande, erreurs de stock, retrait en boutique), suivi, connexion administrateur (refus d'un compte client, restauration de session, déconnexion), produits, commandes.
- Le test d'intégration : `API_URL=http://127.0.0.1:8000/api node scripts/integration.mjs` (après `seed_demo --orders 14`). Il couvre catalogue, commande, stock, annulation, JWT et renouvellement de jeton, création de produit avec image, catégories, zones.

## Déploiement sur Vercel

1. Importez le dépôt dans Vercel, **Root Directory** = `frontend` (Vite est détecté automatiquement).
2. Variable d'environnement : `VITE_API_URL` = `https://VOTRE-API.onrender.com/api` (lue au build : redéployez après l'avoir modifiée).
3. `vercel.json` fournit le repli vers `index.html` (les URL propres comme `/catalogue` fonctionnent au rechargement) et la mise en cache des fichiers.
4. Dans Render, ajoutez l'adresse du site à `CORS_ALLOWED_ORIGINS`.

Les URL de prévisualisation de Vercel (une adresse par branche) ne sont pas autorisées par défaut : ajoutez-les à `CORS_ALLOWED_ORIGINS` si vous voulez les tester.
