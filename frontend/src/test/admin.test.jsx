import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fail, fx, mockApi, renderApp } from './helpers';

const login = fx('login'), dashboard = fx('dashboard'), adminProducts = fx('admin-products'), adminOrders = fx('admin-orders'), customers = fx('customers');
const adminRoutes = (extra = {}) => ({
  'POST /auth/login/': login, 'GET /auth/me/': login.user, 'GET /dashboard/': dashboard, 'GET /products/': adminProducts,
  'GET /orders/': adminOrders, 'GET /customers/': customers, ...extra,
});
const withSession = () => { sessionStorage.setItem('sira.access', 'access.jwt.test'); sessionStorage.setItem('sira.refresh', 'refresh.jwt.test'); };

describe('Connexion administrateur', () => {
  it('redirige vers la connexion sans session', async () => {
    mockApi(adminRoutes());
    renderApp('/admin/dashboard');
    expect(await screen.findByRole('heading', { name: 'Espace administrateur' })).toBeInTheDocument();
  });
  it('se connecte, stocke les jetons et ouvre le tableau de bord', async () => {
    const calls = mockApi(adminRoutes());
    renderApp('/admin');
    await userEvent.type(await screen.findByLabelText('Email'), 'admin@sirayitte.sn');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('heading', { name: 'Tableau de bord' })).toBeInTheDocument();
    expect(calls.of('POST', '/auth/login/')[0].body).toEqual({ email: 'admin@sirayitte.sn', password: 'admin123' });
    expect(sessionStorage.getItem('sira.access')).toBe('access.jwt.test');
    expect(calls.of('GET', '/dashboard/')[0].headers.Authorization).toBe('Bearer access.jwt.test');
    await waitFor(() => expect(screen.getByText('Chiffre d’affaires').previousSibling).toHaveTextContent(/FCFA/));
  });
  it('affiche un message si le mot de passe est faux', async () => {
    mockApi(adminRoutes({ 'POST /auth/login/': () => fail(401, { detail: 'No active account' }) }));
    renderApp('/admin');
    await userEvent.type(await screen.findByLabelText('Email'), 'admin@sirayitte.sn');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'faux');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Email ou mot de passe incorrect')).toBeInTheDocument();
    expect(sessionStorage.getItem('sira.access')).toBeNull();
  });
  it('refuse un compte client (non administrateur)', async () => {
    mockApi(adminRoutes({ 'POST /auth/login/': { ...login, user: { ...login.user, is_staff: false, role: 'client' } } }));
    renderApp('/admin');
    await userEvent.type(await screen.findByLabelText('Email'), 'client@test.sn');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText(/Accès réservé à l'administrateur/)).toBeInTheDocument();
    expect(sessionStorage.getItem('sira.access')).toBeNull();
  });
  it('restaure la session existante (jeton vérifié par /auth/me/)', async () => {
    withSession();
    mockApi(adminRoutes());
    renderApp('/admin/dashboard');
    expect(await screen.findByRole('heading', { name: 'Tableau de bord' })).toBeInTheDocument();
  });
  it('déconnexion : jetons effacés, retour à la connexion', async () => {
    withSession();
    const calls = mockApi(adminRoutes({ 'POST /auth/logout/': null }));
    renderApp('/admin/dashboard');
    await userEvent.click(await screen.findByRole('link', { name: 'Déconnexion' }));
    expect(await screen.findByRole('heading', { name: 'Espace administrateur' })).toBeInTheDocument();
    expect(sessionStorage.getItem('sira.access')).toBeNull();
    expect(calls.of('POST', '/auth/logout/')[0].body).toEqual({ refresh: 'refresh.jwt.test' });
  });
});

describe('Gestion produits et commandes', () => {
  it('liste les produits et active/désactive via PATCH', async () => {
    withSession();
    const p = adminProducts.results[0];
    const calls = mockApi(adminRoutes({ [`PATCH /products/${p.id}/`]: { ...p, is_active: !p.is_active } }));
    renderApp('/admin/produits');
    expect(await screen.findByText(p.name, { selector: 'b' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `Actif ${p.name}` }));
    await waitFor(() => expect(calls.of('PATCH', `/products/${p.id}/`)[0].body).toEqual({ is_active: !p.is_active }));
  });
  it('supprime un produit après confirmation', async () => {
    withSession();
    const p = adminProducts.results[0];
    const calls = mockApi(adminRoutes({ [`DELETE /products/${p.id}/`]: new Response(null, { status: 204 }) }));
    renderApp('/admin/produits');
    await userEvent.click(await screen.findByRole('button', { name: `Supprimer ${p.name}` }));
    expect(calls.of('DELETE', `/products/${p.id}/`)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(calls.of('DELETE', `/products/${p.id}/`)).toHaveLength(1));
  });
  it('crée un produit avec ses variantes (couleurs x tailles)', async () => {
    withSession();
    const created = fx('product-photo');
    const calls = mockApi(adminRoutes({ 'POST /products/': () => created }));
    renderApp('/admin/produits');
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un produit' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nom'), 'Sandale Test');
    await userEvent.type(within(dialog).getByLabelText('Prix (FCFA)'), '19000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(calls.of('POST', '/products/')).toHaveLength(1));
    const { body } = calls.of('POST', '/products/')[0];
    expect(body).toMatchObject({ name: 'Sandale Test', price: 19000, is_active: true });
    expect(body.variants).toHaveLength(7); // une couleur cochée par défaut x tailles 38 à 44
    expect(body.variants[0]).toMatchObject({ size: 38, stock: 5 });
  });
  it('commandes : développe, change le statut par PATCH (transitions autorisées uniquement)', async () => {
    withSession();
    const o = adminOrders.results.find((x) => x.allowed_next_statuses.includes('confirmee'));
    const calls = mockApi(adminRoutes({ [`PATCH /orders/${o.id}/`]: { ...o, status: 'confirmee' } }));
    renderApp('/admin/commandes');
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(o.number.slice(-9)) }));
    const select = await screen.findByLabelText('Changer le statut');
    expect(within(select).queryByRole('option', { name: 'Nouvelle' })).not.toBeInTheDocument();
    await userEvent.selectOptions(select, 'confirmee');
    await waitFor(() => expect(calls.of('PATCH', `/orders/${o.id}/`)[0].body).toEqual({ status: 'confirmee' }));
  });
  it('commandes : filtre par statut envoyé à l’API', async () => {
    withSession();
    const calls = mockApi(adminRoutes());
    renderApp('/admin/commandes');
    await screen.findByRole('button', { name: 'Livrée' });
    await userEvent.click(screen.getByRole('button', { name: 'Livrée' }));
    await waitFor(() => expect(calls.of('GET', '/orders/').at(-1).params.get('status')).toBe('livree'));
  });
  it('clients : tableau issu de l’API', async () => {
    withSession();
    mockApi(adminRoutes());
    renderApp('/admin/clients');
    expect(await screen.findByRole('cell', { name: `${customers.results[0].first_name} ${customers.results[0].last_name}` })).toBeInTheDocument();
  });
});
