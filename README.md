# Sira Yitte - Boutique en ligne de sandales en cuir

*Une caresse de cuir, un voyage de confort.*

```
sira-yitte/
  backend/      API Django REST + PostgreSQL        -> déployée sur Render
  frontend/     Site et tableau de bord React       -> déployé sur Vercel
  render.yaml   Configuration Render (base PostgreSQL + API)
```

---

## 1. Lancer en local avec PostgreSQL (Windows)

**a) Installer PostgreSQL** depuis https://www.postgresql.org/download/windows/ (retenez le mot de passe choisi pour l'utilisateur `postgres`). Puis créez la base, dans PowerShell :

```powershell
& "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -U postgres sira_yitte
```
(adaptez `16` à votre version ; le mot de passe est demandé)

**b) Backend**

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```
Ouvrez `.env` et remplacez `VOTRE_MOT_DE_PASSE` dans la ligne `DATABASE_URL=postgres://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/sira_yitte` (si le mot de passe contient `@ : / # %`, remplacez ces caractères par `%40 %3A %2F %23 %25`). Puis :

```powershell
python manage.py migrate
python manage.py seed_demo --orders 14        # produits, zones, commandes de démo + compte admin de test
python manage.py runserver                    # http://127.0.0.1:8000
```

**c) Frontend** (autre terminal)

```powershell
cd frontend
npm install
npm run dev                                   # http://localhost:5173
```

Tableau de bord : `http://localhost:5173/admin` avec `admin@sirayitte.sn` / `admin123` (compte créé seulement en développement). Documentation de l'API : `http://127.0.0.1:8000/api/docs/`.

---

## 2. Déployer : Render (backend) puis Vercel (frontend)

### Étape 1 - Comptes et dépôt

1. Créez un compte gratuit sur **GitHub**, **Render**, **Vercel** et **Cloudinary** (stockage des photos).
2. Mettez le dossier `sira-yitte` complet dans **un seul dépôt GitHub** (`render.yaml` doit être à la racine du dépôt). Le fichier `.env` n'y sera pas envoyé (déjà ignoré).

### Étape 2 - Cloudinary (photos)

Pourquoi : le disque de Render est effacé à chaque redémarrage, les photos téléversées disparaîtraient. Sur le tableau de bord Cloudinary, copiez la valeur **API environment variable** : `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`.

### Étape 3 - Render (base + API)

1. Render > **New** > **Blueprint** > choisissez votre dépôt. Render lit `render.yaml` et prépare la base PostgreSQL et l'API.
2. Renseignez les 4 variables demandées :

| Variable | Valeur |
| --- | --- |
| `CLOUDINARY_URL` | la valeur copiée à l'étape 2 |
| `DJANGO_SUPERUSER_EMAIL` | votre e-mail d'administrateur |
| `DJANGO_SUPERUSER_PASSWORD` | un mot de passe de **12 caractères minimum** |
| `CORS_ALLOWED_ORIGINS` | provisoire : `https://mon-site.vercel.app` (corrigé à l'étape 5) |

3. Validez. Au premier déploiement, la commande de build crée les tables, les catégories, couleurs et zones de livraison, et votre compte administrateur. Notez l'adresse du service, par exemple `https://sira-yitte-api.onrender.com`.
4. Vérifiez : `https://sira-yitte-api.onrender.com/api/health/` doit afficher `{"status":"ok"}`.
5. Pour charger les 10 produits de démonstration au premier déploiement, mettez `LOAD_DEMO_DATA` à `true` (sinon, ajoutez vos produits depuis le tableau de bord). Ils ne sont chargés qu'une fois.

### Étape 4 - Vercel (site)

1. Vercel > **Add New** > **Project** > votre dépôt.
2. **Root Directory** : `frontend`. Le framework Vite est détecté automatiquement.
3. **Environment Variables** : `VITE_API_URL` = `https://sira-yitte-api.onrender.com/api` (l'adresse de l'étape 3, suivie de `/api`).
4. **Deploy**. Notez l'adresse du site, par exemple `https://sira-yitte.vercel.app`.

### Étape 5 - Autoriser le site auprès de l'API

Dans Render > `sira-yitte-api` > **Environment** : mettez `CORS_ALLOWED_ORIGINS` = l'adresse exacte de votre site Vercel, **sans « / » final** (plusieurs adresses possibles, séparées par une virgule, par exemple avec votre nom de domaine). Render redéploie tout seul.

### Étape 6 - Contrôle final

- Le site s'affiche et le catalogue se charge.
- `/admin` : connexion avec l'e-mail et le mot de passe de l'étape 3.
- Dans le tableau de bord, ajoutez un produit **avec une photo** (elle doit rester après un redémarrage).
- Passez une commande test, puis suivez-la dans `/admin/commandes`.
- Renseignez l'e-mail de la boutique dans *Livraison > Coordonnées* pour recevoir les notifications de commande (envoi réel : configurez aussi `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS=True` et `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` sur Render ; sans cela, les e-mails restent dans les journaux).

---

## 3. À savoir sur l'hébergement gratuit de Render

- **Le service s'endort** après 15 minutes sans visite et met environ une minute à se réveiller. Le site affiche alors « Le serveur démarre… ». Un plan payant (service toujours actif) supprime ce délai.
- **La base PostgreSQL gratuite expire 30 jours après sa création** (14 jours de grâce avant suppression) et **n'a aucune sauvegarde**. Avant l'ouverture au public, passez la base à un plan payant (Render > la base > Settings) ou utilisez un autre hébergeur PostgreSQL gratuit (par exemple Neon : mettez son adresse dans `DATABASE_URL` et `DB_SSL_REQUIRE=True`).
- Vérifiez ces conditions sur render.com/pricing au moment du déploiement, elles évoluent.

## 4. Variables d'environnement du backend

| Variable | Rôle |
| --- | --- |
| `DEBUG` | `False` en production |
| `SECRET_KEY` | générée automatiquement par Render |
| `DATABASE_URL` | liée automatiquement à la base Render |
| `ALLOWED_HOSTS` | l'adresse Render est ajoutée automatiquement ; ajoutez votre domaine personnalisé ici |
| `CORS_ALLOWED_ORIGINS` | adresses du site (Vercel, domaine personnalisé) |
| `CLOUDINARY_URL` | stockage des photos |
| `DJANGO_SUPERUSER_EMAIL` / `DJANGO_SUPERUSER_PASSWORD` | compte administrateur créé au déploiement (jamais écrasé ensuite) |
| `SHOP_WHATSAPP` / `SHOP_EMAIL` | valeurs initiales des coordonnées (modifiables ensuite dans le tableau de bord) |
| `LOAD_DEMO_DATA` | `true` pour charger les produits de démonstration (une seule fois) |
| `DB_SSL_REQUIRE` | `True` si la base est jointe par son adresse externe |

Frontend (Vercel) : `VITE_API_URL` uniquement.

## 5. Tests

| Où | Commande | Résultat |
| --- | --- | --- |
| backend | `python manage.py test` | 64 tests (exécutés sur PostgreSQL 16) |
| frontend | `npm test` | 29 tests d'interface |
| frontend | `npm run test:integration` | 16 tests du client API contre le backend lancé |

**Vérifié** : les tests ci-dessus sur PostgreSQL, un déploiement simulé comme sur Render (build, démarrage gunicorn, HTTPS, hôtes autorisés, CORS limité au site, fichiers statiques de l'administration, `check --deploy`), le build du frontend.
**Non vérifié ici** : l'envoi réel vers Cloudinary (réseau non autorisé dans l'environnement de test ; le stockage est testé avec des simulations), le déploiement sur les vrais Render et Vercel, et l'affichage dans un navigateur.
