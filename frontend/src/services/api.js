/**
 * Client de l'API Django REST (backend Sira Yitte).
 * - URL de base : VITE_API_URL (injectée AU BUILD : elle doit être définie dans les variables
 *   du projet Vercel, sinon les appels renvoient la page HTML du site et sont refusés ici).
 *   Sans variable, "/api" est utilisé (proxifié vers Django en développement).
 * - Authentification JWT : jeton d'accès + jeton de rafraîchissement, renouvelé automatiquement sur 401.
 * - Les erreurs sont normalisées en ApiError (statut + données DRF) avec des messages en français.
 */
const BASE = String(globalThis.SIRA_API_URL || import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');

/* ---------- stockage des jetons (sessionStorage, repli mémoire) ---------- */
const mem = {};
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { mem[k] = v; } },
  del(k) { try { sessionStorage.removeItem(k); } catch { delete mem[k]; } },
};
export const hasTokens = () => !!(store.get('sira.access') || store.get('sira.refresh'));
export const clearTokens = () => { store.del('sira.access'); store.del('sira.refresh'); };
const setTokens = ({ access, refresh }) => { if (access) store.set('sira.access', access); if (refresh) store.set('sira.refresh', refresh); };

let onAuthLost = () => {};
export const setUnauthorizedHandler = (fn) => { onAuthLost = fn; };

/* ---------- erreurs ---------- */
const FIELD_LABELS = {
  first_name: 'Prénom', last_name: 'Nom', phone: 'Téléphone', email: 'E-mail', address: 'Adresse', zone: 'Zone',
  items: 'Panier', name: 'Nom', price: 'Prix', old_price: 'Ancien prix', category: 'Catégorie', image: 'Image', variants: 'Variantes',
  stock: 'Stock', status: 'Statut', fee: 'Frais', whatsapp_number: 'Numéro WhatsApp', password: 'Mot de passe', number: 'Numéro',
};
const flatten = (v) => (Array.isArray(v) ? v.flatMap(flatten) : v && typeof v === 'object' ? Object.values(v).flatMap(flatten) : v ? [String(v)] : []);

export class ApiError extends Error {
  constructor(status, data) {
    super(ApiError.message(status, data));
    this.status = status;
    this.data = data;
  }

  static message(status, data) {
    if (status === 0) return data?.detail || 'Impossible de joindre le serveur.';
    if (data?.detail) return String(data.detail);
    if (data && typeof data === 'object') {
      const parts = Object.entries(data).flatMap(([k, v]) => flatten(v).map((m) => (FIELD_LABELS[k] && k !== 'non_field_errors' ? `${FIELD_LABELS[k]} : ${m}` : m)));
      if (parts.length) return parts.join(' ');
    }
    if (status === 429) return 'Trop de requêtes. Réessayez dans quelques instants.';
    return `Erreur serveur (${status}). Réessayez plus tard.`;
  }

  /** Erreurs de validation par champ : { phone: "…", items: ["…"] } */
  get fields() {
    const out = {};
    if (this.data && typeof this.data === 'object' && !this.data.detail) {
      Object.entries(this.data).forEach(([k, v]) => { out[k] = flatten(v); });
    }
    return out;
  }
}
export const errorMessage = (e) => (e instanceof ApiError ? e.message : 'Une erreur inattendue est survenue.');

/* ---------- requêtes ---------- */
const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

function send(path, { method = 'GET', body, params, auth = true } = {}) {
  const headers = {};
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const token = store.get('sira.access');
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  return fetch(BASE + path + qs(params), { method, headers, body: payload });
}

let refreshing = null;
async function refreshTokens() {
  const refresh = store.get('sira.refresh');
  if (!refresh) return false;
  refreshing = refreshing || (async () => {
    try {
      const res = await send('/auth/refresh/', { method: 'POST', body: { refresh }, auth: false });
      if (!res.ok) return false;
      setTokens(await res.json());
      return true;
    } catch { return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

export async function request(path, opts = {}) {
  let res;
  try {
    res = await send(path, opts);
    if (res.status === 401 && opts.auth !== false && store.get('sira.refresh')) {
      if (await refreshTokens()) res = await send(path, opts);
      else { clearTokens(); onAuthLost(); }
    }
  } catch {
    throw new ApiError(0, { detail: 'Impossible de joindre le serveur. Vérifiez votre connexion.' });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) {
    // Une route d'API qui renvoie du HTML (page index.html) signale presque toujours une
    // VITE_API_URL absente ou erronée au moment du build : on lève une erreur explicite
    // plutôt que de laisser les pages recevoir `null` et se rendre inutilisables.
    throw new ApiError(0, { detail: "Le serveur n'a pas répondu en JSON. Vérifiez la variable VITE_API_URL définie au déploiement." });
  }
  return data;
}

/* ---------- endpoints ---------- */
const json = (method, path) => (body, params) => request(path, { method, body, params });

export const api = {
  /* public */
  shop: () => request('/shop/'),
  zones: () => request('/delivery-zones/'),
  categories: () => request('/categories/'),
  colors: () => request('/colors/'),
  products: (params) => request('/products/', { params }),
  featured: () => request('/products/featured/'),
  product: (slugOrId) => request(`/products/${slugOrId}/`),
  createOrder: (payload) => request('/orders/', { method: 'POST', body: payload }),
  trackOrder: (number, phone) => request('/orders/track/', { params: { number, phone } }),

  /* authentification */
  async login(email, password) {
    const data = await request('/auth/login/', { method: 'POST', body: { email, password }, auth: false });
    setTokens(data);
    return data;
  },
  me: () => request('/auth/me/'),
  async logout() {
    const refresh = store.get('sira.refresh');
    clearTokens();
    if (refresh) { try { await request('/auth/logout/', { method: 'POST', body: { refresh }, auth: false }); } catch { /* déjà expiré */ } }
  },

  /* administration */
  admin: {
    dashboard: () => request('/dashboard/'),
    products: (params) => request('/products/', { params }),
    product: (id) => request(`/products/${id}/`),
    createProduct: (body) => request('/products/', { method: 'POST', body }),
    updateProduct: (id, body) => request(`/products/${id}/`, { method: 'PATCH', body }),
    deleteProduct: (id) => request(`/products/${id}/`, { method: 'DELETE' }),
    uploadImage: (id, file, extra = {}) => {
      const fd = new FormData();
      // le serveur contrôle l'extension : on garantit un nom de fichier même pour un Blob anonyme
      fd.append('image', file, file.name || `image.${(file.type || 'image/png').split('/')[1] || 'png'}`);
      Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
      return request(`/products/${id}/images/`, { method: 'POST', body: fd });
    },
    updateImage: (id, body) => request(`/product-images/${id}/`, { method: 'PATCH', body }),
    deleteImage: (id) => request(`/product-images/${id}/`, { method: 'DELETE' }),
    createCategory: json('POST', '/categories/'),
    updateCategory: (id, body) => request(`/categories/${id}/`, { method: 'PATCH', body }),
    deleteCategory: (id) => request(`/categories/${id}/`, { method: 'DELETE' }),
    updateVariant: (id, stock) => request(`/variants/${id}/`, { method: 'PATCH', body: { stock } }),
    orders: (params) => request('/orders/', { params }),
    updateOrder: (id, body) => request(`/orders/${id}/`, { method: 'PATCH', body }),
    customers: (params) => request('/customers/', { params }),
    createZone: (body) => request('/delivery-zones/', { method: 'POST', body }),
    updateZone: (id, body) => request(`/delivery-zones/${id}/`, { method: 'PATCH', body }),
    deleteZone: (id) => request(`/delivery-zones/${id}/`, { method: 'DELETE' }),
    updateShop: (body) => request('/shop/', { method: 'PATCH', body }),
  },
};
