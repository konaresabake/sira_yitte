import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { computeTotals } from '../utils/shop';
import { useShop } from './ShopContext';
import { useToast } from './ToastContext';

const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);
const KEY = 'sira-cart-v2';

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.items)) return s; } catch { /* ignore */ }
  return { items: [], zoneId: null };
}

/**
 * Panier (stocké dans le navigateur). Chaque ligne désigne une variante précise (taille + couleur) de l'API.
 * Le serveur revérifie stock et prix au moment de la commande.
 */
export function CartProvider({ children }) {
  const toast = useToast();
  const { zones } = useShop();
  const [S, setS] = useState(load);
  const ref = useRef(S);
  ref.current = S;
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ } }, [S]);

  const add = useCallback((product, variant, qty = 1) => {
    const ex = ref.current.items.find((i) => i.variantId === variant.id);
    if (variant.stock <= 0) { toast('Cette variante est en rupture de stock'); return false; }
    const n = Math.min(qty, variant.stock - (ex ? ex.qty : 0));
    if (n <= 0) { toast('Stock maximum déjà dans votre panier'); return false; }
    setS((s) => ({
      ...s,
      items: s.items.some((i) => i.variantId === variant.id)
        ? s.items.map((i) => (i.variantId === variant.id ? { ...i, qty: i.qty + n, stock: variant.stock } : i))
        : [...s.items, { variantId: variant.id, productId: product.id, slug: product.slug, name: product.name, price: product.price,
          color: variant.color_name, hex: variant.hex_code, size: variant.size, qty: n, stock: variant.stock, image: product.image || null }],
    }));
    toast('Ajouté au panier ✓');
    return true;
  }, [toast]);

  const setQty = useCallback((variantId, qty) => setS((s) => ({
    ...s, items: s.items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.max(1, Math.min(i.stock, qty)) } : i)),
  })), []);
  const remove = useCallback((variantId) => { setS((s) => ({ ...s, items: s.items.filter((i) => i.variantId !== variantId) })); toast('Article retiré'); }, [toast]);
  const clear = useCallback(() => setS((s) => ({ ...s, items: [] })), []);
  const setZone = useCallback((zoneId) => setS((s) => ({ ...s, zoneId })), []);

  /** Réactualise prix et stocks depuis l'API ; retire les articles devenus indisponibles. */
  const sync = useCallback(async () => {
    const items = ref.current.items;
    if (!items.length) return;
    const slugs = [...new Set(items.map((i) => i.slug))];
    const res = await Promise.allSettled(slugs.map((s) => api.product(s)));
    const fresh = {};
    res.forEach((r, k) => {
      if (r.status === 'fulfilled') fresh[slugs[k]] = r.value;
      else if (r.reason?.status === 404) fresh[slugs[k]] = null;
    });
    const removed = [];
    const next = [];
    items.forEach((i) => {
      if (!(i.slug in fresh)) { next.push(i); return; }
      const p = fresh[i.slug];
      const v = p?.variants.find((x) => x.id === i.variantId);
      if (!p || !v || v.stock <= 0) { removed.push(i.name); return; }
      next.push({ ...i, name: p.name, price: p.price, image: p.image || null, stock: v.stock, qty: Math.min(i.qty, v.stock) });
    });
    if (JSON.stringify(next) !== JSON.stringify(items)) setS((s) => ({ ...s, items: next }));
    if (removed.length) toast(`Plus disponible, retiré du panier : ${removed.join(', ')}`);
  }, [toast]);

  const zone = zones.find((z) => z.id === S.zoneId) || zones[0] || null;
  const value = useMemo(() => ({
    items: S.items, count: S.items.reduce((a, i) => a + i.qty, 0), zone, zoneId: zone?.id ?? null,
    add, setQty, remove, clear, setZone, sync,
    totals: (mode) => computeTotals(S.items, zone, mode),
  }), [S, zone, add, setQty, remove, clear, setZone, sync]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
