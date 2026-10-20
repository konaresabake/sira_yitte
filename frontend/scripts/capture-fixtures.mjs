/** Enregistre de vraies réponses de l'API dans src/test/fixtures/ (utilisées par les tests de l'interface). */
import { mkdirSync, writeFileSync } from 'node:fs';

const API = process.env.API_URL || 'http://127.0.0.1:8000/api';
const dir = new URL('../src/test/fixtures/', import.meta.url);
mkdirSync(dir, { recursive: true });
const clean = (v) => JSON.parse(JSON.stringify(v).replaceAll(new URL(API).origin, 'http://localhost'));
const get = async (path, token) => (await fetch(API + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })).json();
const save = (name, data) => writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(clean(data), null, 1));

const login = await (await fetch(`${API}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL || 'admin@sirayitte.sn', password: process.env.ADMIN_PASSWORD || 'admin123' }) })).json();
const t = login.access;
save('shop', await get('/shop/'));
save('zones', await get('/delivery-zones/'));
save('categories', await get('/categories/'));
save('colors', await get('/colors/'));
save('featured', await get('/products/featured/'));
save('products', await get('/products/?page_size=6'));
save('product-photo', await get('/products/sandale-soleil-bordeaux/'));
save('product-svg', await get('/products/sandale-classique-dakar/'));
save('login', { ...login, access: 'access.jwt.test', refresh: 'refresh.jwt.test' });
save('dashboard', await get('/dashboard/', t));
save('admin-products', await get('/products/?page_size=15&ordering=newest', t));
save('admin-orders', await get('/orders/?page_size=10', t));
save('customers', await get('/customers/?page_size=12', t));
const photo = await get('/products/sandale-soleil-bordeaux/');
const v = photo.variants.find((x) => x.stock > 3);
const zone = (await get('/delivery-zones/')).find((z) => z.fee === 2000);
const order = await (await fetch(`${API}/orders/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name: 'Awa', last_name: 'Diop', phone: '77 412 08 15', address: 'Rue 10, Pikine', zone: zone.id, items: [{ variant: v.id, quantity: 1 }] }) })).json();
save('order-created', order);
save('order-track', await get(`/orders/track/?number=${order.number}&phone=774120815`));
console.log('Fixtures enregistrées dans src/test/fixtures/');
