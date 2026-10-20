import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { ShopProvider } from '../context/ShopContext';
import { ToastProvider } from '../context/ToastContext';
import categories from './fixtures/categories.json';
import colors from './fixtures/colors.json';
import shop from './fixtures/shop.json';
import zones from './fixtures/zones.json';

export const fx = (name) => JSON.parse(JSON.stringify(require_json(name)));
const files = import.meta.glob('./fixtures/*.json', { eager: true });
function require_json(name) { return files[`./fixtures/${name}.json`].default; }

const json = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Simule l'API : `routes` associe "METHODE /chemin/" à une réponse (objet) ou une fonction ({ params, body }) -> objet | Response.
 * Les routes communes (boutique, zones, catégories, couleurs) sont déjà fournies. Renvoie la liste des appels effectués.
 */
export function mockApi(routes = {}) {
  const calls = [];
  const all = { 'GET /shop/': shop, 'GET /delivery-zones/': zones, 'GET /categories/': categories, 'GET /colors/': colors, ...routes };
  vi.stubGlobal('fetch', vi.fn(async (url, opts = {}) => {
    const u = new URL(url, 'http://localhost');
    const method = (opts.method || 'GET').toUpperCase();
    const path = u.pathname.replace(/^\/api/, '');
    const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
    calls.push({ method, path, params: u.searchParams, body, headers: opts.headers || {} });
    const h = all[`${method} ${path}`];
    if (h === undefined) return json({ detail: `Route non simulée : ${method} ${path}` }, 404);
    const out = typeof h === 'function' ? await h({ params: u.searchParams, body }) : h;
    return out instanceof Response ? out : json(out);
  }));
  calls.of = (method, path) => calls.filter((c) => c.method === method && c.path === path);
  return calls;
}
export const fail = (status, data) => json(data, status);

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider><ShopProvider><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></ShopProvider></ToastProvider>
    </MemoryRouter>,
  );
}

/** Panier prérempli dans localStorage (comme après un ajout depuis la fiche produit). */
export function seedCart(items, zoneId = null) {
  localStorage.setItem('sira-cart-v2', JSON.stringify({ items, zoneId }));
}
export const cartItem = (p, v, qty = 1) => ({ variantId: v.id, productId: p.id, slug: p.slug, name: p.name, price: p.price, color: v.color_name, hex: v.hex_code, size: v.size, qty, stock: v.stock, image: p.image });
