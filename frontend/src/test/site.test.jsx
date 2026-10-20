import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { cartItem, fail, fx, mockApi, renderApp, seedCart } from './helpers';

const featured = fx('featured'), products = fx('products'), photo = fx('product-photo'), svg = fx('product-svg');
const buy = photo.variants.find((v) => v.stock > 3);
const soldOut = photo.variants.find((v) => v.stock === 0);

describe('Accueil', () => {
  it('affiche les produits vedettes venant de l’API', async () => {
    mockApi({ 'GET /products/featured/': featured });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: featured[0].name })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Sandale (homme|femme|premium|classique|traditionnelle)/i }).length).toBeGreaterThan(0);
  });
  it('affiche un message avec « Réessayer » si l’API est en erreur', async () => {
    const calls = mockApi({ 'GET /products/featured/': () => fail(500, { detail: 'Erreur interne' }) });
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur interne');
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(calls.of('GET', '/products/featured/').length).toBe(2));
  });
});

describe('Serveur injoignable', () => {
  it('affiche une bannière avec « Réessayer » quand les réglages ne se chargent pas', async () => {
    const calls = mockApi({ 'GET /shop/': () => fail(503, { detail: 'Service indisponible' }), 'GET /products/featured/': featured });
    renderApp('/');
    expect(await screen.findByText('Service indisponible')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Réessayer' })[0]);
    await waitFor(() => expect(calls.of('GET', '/shop/').length).toBeGreaterThan(1));
  });
});

describe('Serveur en cours de réveil', () => {
  it('prévient le visiteur si le serveur met du temps à répondre', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockApi({ 'GET /shop/': () => new Promise(() => {}), 'GET /products/featured/': featured });
      renderApp('/');
      expect(screen.queryByText(/Le serveur démarre/)).not.toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(6500);
      expect(await screen.findByText(/Le serveur démarre/)).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
});

describe('Catalogue', () => {
  it('liste les produits et envoie les filtres à l’API', async () => {
    const calls = mockApi({ 'GET /products/': products });
    renderApp('/catalogue');
    expect(await screen.findByText(`${products.count} modèles`)).toBeInTheDocument();
    expect(calls.of('GET', '/products/')[0].params.get('page_size')).toBe('6');

    await userEvent.click(screen.getByRole('button', { name: 'Homme' }));
    await waitFor(() => expect(calls.of('GET', '/products/').at(-1).params.get('category')).toBe('homme'));
    await userEvent.click(screen.getByRole('button', { name: '42' }));
    await waitFor(() => expect(calls.of('GET', '/products/').at(-1).params.get('size')).toBe('42'));
    await userEvent.click(screen.getByLabelText('En stock uniquement'));
    await waitFor(() => expect(calls.of('GET', '/products/').at(-1).params.get('in_stock')).toBe('true'));
    await userEvent.selectOptions(screen.getByLabelText('Trier'), 'price_asc');
    await waitFor(() => expect(calls.of('GET', '/products/').at(-1).params.get('ordering')).toBe('price_asc'));
  });
  it('recherche avec une courte pause (anti-rafale)', async () => {
    const calls = mockApi({ 'GET /products/': products });
    renderApp('/catalogue');
    await screen.findByText(`${products.count} modèles`);
    const before = calls.of('GET', '/products/').length;
    await userEvent.type(screen.getByLabelText('Rechercher'), 'saly');
    await waitFor(() => expect(calls.of('GET', '/products/').at(-1).params.get('search')).toBe('saly'));
    expect(calls.of('GET', '/products/').length - before).toBe(1); // une seule requête pour 4 touches
  });
  it('lit la catégorie dans l’URL et affiche « aucun résultat »', async () => {
    const calls = mockApi({ 'GET /products/': { count: 0, next: null, previous: null, results: [] } });
    renderApp('/catalogue?category=premium');
    expect(await screen.findByText('Aucune sandale trouvée')).toBeInTheDocument();
    expect(calls.of('GET', '/products/')[0].params.get('category')).toBe('premium');
  });
});

describe('Fiche produit et panier', () => {
  it('choix de taille (rupture désactivée) puis ajout au panier', async () => {
    mockApi({ 'GET /products/sandale-soleil-bordeaux/': photo });
    renderApp('/sandales/sandale-soleil-bordeaux');
    expect(await screen.findByRole('heading', { name: photo.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: String(soldOut.size) })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter au panier' }));
    expect(await screen.findByText('Choisissez une taille')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: String(buy.size) }));
    expect(screen.getByText(new RegExp(`${buy.stock} disponibles|Plus que ${buy.stock}`))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter au panier' }));
    expect(await screen.findByText('Ajouté au panier ✓')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Panier, 1 article/ })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('sira-cart-v2')).items[0]).toMatchObject({ variantId: buy.id, size: buy.size, price: photo.price, qty: 1 });
  });
  it('produit introuvable', async () => {
    mockApi({ 'GET /products/inconnu/': () => fail(404, { detail: 'Introuvable.' }) });
    renderApp('/sandales/inconnu');
    expect(await screen.findByText('Sandale introuvable')).toBeInTheDocument();
  });
  it('produit sans photo : illustration de repli', async () => {
    mockApi({ 'GET /products/sandale-classique-dakar/': svg });
    renderApp('/sandales/sandale-classique-dakar');
    await screen.findByRole('heading', { name: svg.name });
    expect(document.querySelector('.big svg')).toBeInTheDocument();
  });
  it('le panier se synchronise : stock réduit et produit retiré', async () => {
    const v = photo.variants.find((x) => x.stock >= 3);
    const gone = { ...cartItem(svg, svg.variants[0]), slug: 'disparu', name: 'Sandale Disparue', variantId: 99999 };
    seedCart([cartItem(photo, v, 3), gone]);
    const lower = { ...photo, variants: photo.variants.map((x) => (x.id === v.id ? { ...x, stock: 1 } : x)) };
    mockApi({ 'GET /products/sandale-soleil-bordeaux/': lower, 'GET /products/disparu/': () => fail(404, { detail: 'Introuvable.' }) });
    renderApp('/panier');
    expect(await screen.findByText(/Plus disponible, retiré du panier : Sandale Disparue/)).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(localStorage.getItem('sira-cart-v2')).items).toHaveLength(1));
    expect(JSON.parse(localStorage.getItem('sira-cart-v2')).items[0].qty).toBe(1); // 3 demandés, 1 en stock
  });
});

describe('Commande', () => {
  const order = fx('order-created');
  const fill = async () => {
    await userEvent.type(screen.getByLabelText('Prénom'), 'Awa');
    await userEvent.type(screen.getByLabelText('Nom'), 'Diop');
    await userEvent.type(screen.getByLabelText('Téléphone'), '77 412 08 15');
    await userEvent.type(screen.getByLabelText('Adresse'), 'Rue 10, Pikine');
  };
  it('valide le formulaire côté client avant d’appeler l’API', async () => {
    seedCart([cartItem(photo, buy, 2)]);
    const calls = mockApi({ 'GET /products/sandale-soleil-bordeaux/': photo });
    renderApp('/commande');
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmer la commande' }));
    expect(await screen.findByText('Indiquez votre prénom')).toBeInTheDocument();
    expect(screen.getByText(/Numéro invalide/)).toBeInTheDocument();
    expect(calls.of('POST', '/orders/')).toHaveLength(0);
  });
  it('envoie la commande à l’API, vide le panier et affiche la confirmation', async () => {
    seedCart([cartItem(photo, buy, 2)]);
    const calls = mockApi({ 'GET /products/sandale-soleil-bordeaux/': photo, 'POST /orders/': () => order });
    renderApp('/commande');
    await screen.findByRole('button', { name: 'Confirmer la commande' });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la commande' }));
    expect(await screen.findByText(`Commande #${order.number}`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /commande reçue/ })).toBeInTheDocument();
    const [post] = calls.of('POST', '/orders/');
    expect(post.body).toMatchObject({ first_name: 'Awa', last_name: 'Diop', phone: '77 412 08 15', address: 'Rue 10, Pikine', delivery_mode: 'livraison',
      items: [{ variant: buy.id, quantity: 2 }] });
    expect(post.body.zone).toBeTypeOf('number');
    expect(post.body).not.toHaveProperty('total'); // le prix n'est jamais envoyé
    expect(JSON.parse(localStorage.getItem('sira-cart-v2')).items).toHaveLength(0);
  });
  it('affiche les erreurs de stock renvoyées par le serveur et conserve le panier', async () => {
    seedCart([cartItem(photo, buy, 2)]);
    mockApi({ 'GET /products/sandale-soleil-bordeaux/': photo,
      'POST /orders/': () => fail(400, { items: [`${photo.name} (Bordeaux, taille ${buy.size}) : seulement 1 disponible(s) pour 2 demandé(s).`] }) });
    renderApp('/commande');
    await screen.findByRole('button', { name: 'Confirmer la commande' });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la commande' }));
    expect(await screen.findByText(/seulement 1 disponible/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmer la commande' })).toBeEnabled();
    expect(JSON.parse(localStorage.getItem('sira-cart-v2')).items).toHaveLength(1);
  });
  it('retrait en boutique : pas d’adresse ni de zone envoyées', async () => {
    seedCart([cartItem(photo, buy, 1)]);
    const calls = mockApi({ 'GET /products/sandale-soleil-bordeaux/': photo, 'POST /orders/': () => order });
    renderApp('/commande');
    await screen.findByRole('button', { name: 'Confirmer la commande' });
    await userEvent.click(screen.getByLabelText('Retrait en boutique'));
    expect(screen.queryByLabelText('Adresse')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Prénom'), 'Awa');
    await userEvent.type(screen.getByLabelText('Nom'), 'Diop');
    await userEvent.type(screen.getByLabelText('Téléphone'), '774120815');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la commande' }));
    await screen.findByText(`Commande #${order.number}`);
    expect(calls.of('POST', '/orders/')[0].body).toMatchObject({ delivery_mode: 'retrait', zone: null });
  });
});

describe('Suivi de commande', () => {
  it('interroge l’API avec le numéro et le téléphone', async () => {
    const track = fx('order-track');
    const calls = mockApi({ 'GET /orders/track/': track });
    renderApp(`/suivi?number=${track.number}`);
    expect(screen.getByLabelText('Numéro de commande')).toHaveValue(track.number);
    await userEvent.type(screen.getByLabelText('Téléphone'), '77 412 08 15');
    await userEvent.click(screen.getByRole('button', { name: 'Voir le statut' }));
    expect(await screen.findByText(`Commande #${track.number}`)).toBeInTheDocument();
    expect(calls.of('GET', '/orders/track/')[0].params.get('phone')).toBe('77 412 08 15');
  });
  it('commande inconnue : message clair', async () => {
    mockApi({ 'GET /orders/track/': () => fail(404, { detail: 'Not found.' }) });
    renderApp('/suivi');
    await userEvent.type(screen.getByLabelText('Numéro de commande'), 'CMD-2026-99999');
    await userEvent.type(screen.getByLabelText('Téléphone'), '770000000');
    await userEvent.click(screen.getByRole('button', { name: 'Voir le statut' }));
    expect(await screen.findByText(/Aucune commande ne correspond/)).toBeInTheDocument();
  });
});
