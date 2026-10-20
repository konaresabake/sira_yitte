/**
 * Test d'intégration : exécute le client API du frontend (src/services/api.js) contre un backend Django réel.
 *   1. Dans le backend : python manage.py seed_demo --orders 14 && python manage.py runserver 8000
 *   2. Ici :             API_URL=http://127.0.0.1:8000/api ADMIN_EMAIL=admin@sirayitte.sn ADMIN_PASSWORD=admin123 node scripts/integration.mjs
 */
import assert from 'node:assert/strict';

const API_URL = process.env.API_URL || 'http://127.0.0.1:8000/api';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@sirayitte.sn';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const data = new Map();
globalThis.sessionStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
globalThis.SIRA_API_URL = API_URL;
const { api, ApiError, errorMessage, hasTokens } = await import('../src/services/api.js');

let n = 0;
const step = async (name, fn) => { try { await fn(); n++; console.log('  ok ', name); } catch (e) { console.error('  ÉCHEC', name, '\n      ', e.message); process.exitCode = 1; } };
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

console.log(`Intégration frontend -> ${API_URL}`);
let order, product, newProduct, zone;

await step('réglages boutique, zones, catégories, couleurs', async () => {
  const [shop, zones, cats, colors] = await Promise.all([api.shop(), api.zones(), api.categories(), api.colors()]);
  assert.equal(shop.whatsapp_number, '221775857358');
  assert.ok(zones.length >= 3 && zones.some((z) => z.fee_to_confirm));
  assert.ok(cats.length === 5 && colors.length >= 6);
  zone = zones.find((z) => z.fee === 2000);
});
await step('catalogue : pagination, filtres, tri', async () => {
  const p1 = await api.products({ page_size: 4, ordering: 'price_asc' });
  assert.equal(p1.results.length, 4);
  assert.ok(p1.results[0].price <= p1.results[1].price && p1.count >= 10);
  assert.ok((await api.products({ category: 'homme' })).results.every((p) => p.category.slug === 'homme'));
  assert.ok((await api.products({ price_max: 15000 })).results.every((p) => p.price <= 15000));
  assert.ok((await api.products({ search: 'bordeaux' })).count >= 1);
  assert.ok((await api.featured()).length > 0);
  await assert.rejects(api.products({ page: 99 }), (e) => e instanceof ApiError && e.status === 404);
});
await step('fiche produit par slug (variantes, images)', async () => {
  product = await api.product('sandale-soleil-bordeaux');
  assert.equal(product.images.length, 1);
  assert.ok(product.variants.every((v) => v.id && v.hex_code && 'stock' in v));
  await assert.rejects(api.product('inconnu'), (e) => e.status === 404);
});
await step('commande publique : totaux serveur, stock décrémenté', async () => {
  const v = product.variants.find((x) => x.stock >= 3);
  order = await api.createOrder({ first_name: 'Test', last_name: 'Intégration', phone: '77 000 11 22', address: 'Rue 1', zone: zone.id,
    delivery_mode: 'livraison', items: [{ variant: v.id, quantity: 2 }] });
  assert.match(order.number, /^CMD-\d{4}-\d{5}$/);
  assert.equal(order.total, product.price * 2 + 2000);
  assert.equal((await api.product('sandale-soleil-bordeaux')).variants.find((x) => x.id === v.id).stock, v.stock - 2);
});
await step('erreurs de commande lisibles (stock insuffisant)', async () => {
  const v = product.variants[0];
  await assert.rejects(api.createOrder({ first_name: 'A', last_name: 'B', phone: '770001122', address: 'x', zone: zone.id, items: [{ variant: v.id, quantity: 20 }] }), (e) => {
    assert.ok(e.fields.items[0].includes('disponible') || e.fields.items[0].includes('rupture'));
    assert.ok(errorMessage(e).startsWith('Panier'));
    return e.status === 400;
  });
});
await step('suivi public de commande', async () => {
  const t = await api.trackOrder(order.number, '+221 77 000 11 22');
  assert.equal(t.status, 'nouvelle');
  assert.equal(t.phone, undefined);
  await assert.rejects(api.trackOrder(order.number, '700000000'), (e) => e.status === 404);
});
await step('routes admin refusées sans connexion', async () => {
  await assert.rejects(api.admin.dashboard(), (e) => e.status === 401);
  await assert.rejects(api.admin.orders(), (e) => e.status === 401);
});
await step('connexion : mauvais mot de passe puis succès', async () => {
  await assert.rejects(api.login(EMAIL, 'faux'), (e) => e.status === 401);
  const d = await api.login(EMAIL, PASSWORD);
  assert.ok(d.user.is_staff && hasTokens());
  assert.equal((await api.me()).email, EMAIL);
});
await step('tableau de bord, commandes, clients', async () => {
  const d = await api.admin.dashboard();
  assert.ok(d.orders_count >= 15 && d.revenue > 0 && d.sales_last_7_days.length === 7);
  const list = await api.admin.orders({ status: 'nouvelle', search: order.number, page_size: 10 });
  assert.equal(list.count, 1);
  assert.deepEqual(list.results[0].allowed_next_statuses.includes('confirmee'), true);
  assert.ok((await api.admin.customers({ page_size: 5 })).count >= 3);
});
await step('statut : transition valide, transition interdite, annulation restitue le stock', async () => {
  const o = (await api.admin.orders({ search: order.number })).results[0];
  assert.equal((await api.admin.updateOrder(o.id, { status: 'confirmee' })).status, 'confirmee');
  await assert.rejects(api.admin.updateOrder(o.id, { status: 'nouvelle' }), (e) => e.status === 400 && e.message.includes('Transition'));
  const before = (await api.product('sandale-soleil-bordeaux')).variants.reduce((a, v) => a + v.stock, 0);
  await api.admin.updateOrder(o.id, { status: 'annulee' });
  assert.equal((await api.product('sandale-soleil-bordeaux')).variants.reduce((a, v) => a + v.stock, 0), before + 2);
});
await step('renouvellement automatique du jeton expiré', async () => {
  const old = data.get('sira.access');
  data.set('sira.access', 'jeton.invalide.expire');
  assert.ok((await api.admin.dashboard()).orders_count > 0);
  assert.notEqual(data.get('sira.access'), old);
});
await step('produit : création avec variantes, image, modification, suppression', async () => {
  const cats = await api.categories(), colors = await api.colors();
  newProduct = await api.admin.createProduct({ name: 'Sandale Test Intégration', category: cats[0].id, price: 21000, old_price: 25000, material: 'Cuir',
    variants: [{ color: colors[0].id, size: 40, stock: 3 }, { color: colors[1].id, size: 41, stock: 0 }] });
  assert.equal(newProduct.slug, 'sandale-test-integration');
  const fd = await api.admin.uploadImage(newProduct.id, new Blob([PNG], { type: 'image/png' }), { alt_text: 'Photo test' });
  assert.ok(fd.is_main && fd.image.includes('.webp'));
  const upd = await api.admin.updateProduct(newProduct.id, { price: 20000, is_featured: true });
  assert.equal(upd.price, 20000);
  await assert.rejects(api.admin.updateProduct(newProduct.id, { old_price: 100 }), (e) => e.status === 400 && !!e.fields.old_price);
  assert.equal(upd.variants.length, 2);
  assert.ok((await api.admin.products({ search: 'Test Intégration' })).count === 1);
});
await step('stock : ajustement d’une variante', async () => {
  const p = await api.admin.product(newProduct.id);
  assert.equal((await api.admin.updateVariant(p.variants[0].id, 9)).stock, 9);
});
await step('catégories, zones et réglages : création, modification, suppression', async () => {
  const c = await api.admin.createCategory({ name: 'Catégorie Test' });
  assert.equal((await api.admin.updateCategory(c.id, { is_active: false })).is_active, false);
  await api.admin.deleteCategory(c.id);
  const z = await api.admin.createZone({ name: 'Zone Test', fee: null });
  assert.equal((await api.admin.updateZone(z.id, { fee: 3000 })).fee, 3000);
  await api.admin.deleteZone(z.id);
  const shop = await api.admin.updateShop({ opening_hours: 'Lundi au samedi, 9h à 19h' });
  assert.ok('low_stock_threshold' in shop);
  await assert.rejects(api.admin.deleteCategory((await api.categories())[0].id), (e) => e.status === 409);
});
await step('suppression du produit de test, déconnexion (jeton invalidé)', async () => {
  await api.admin.deleteProduct(newProduct.id);
  await assert.rejects(api.product(newProduct.slug), (e) => e.status === 404);
  const refresh = data.get('sira.refresh');
  await api.logout();
  assert.equal(hasTokens(), false);
  const res = await fetch(`${API_URL}/auth/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }) });
  assert.equal(res.status, 401);
});
await step('serveur injoignable : message clair', async () => {
  globalThis.SIRA_API_URL = 'http://127.0.0.1:9';
  const { request } = await import('../src/services/api.js?down');
  await assert.rejects(request('/shop/'), (e) => e.status === 0 && /joindre le serveur/.test(e.message));
});
console.log(process.exitCode ? '\nÉCHEC' : `\nTOUS LES TESTS D'INTÉGRATION PASSENT (${n})`);
