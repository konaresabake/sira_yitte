import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../services/api';

const Ctx = createContext(null);
export const useShop = () => useContext(Ctx);

// Valeurs de secours si l'API est injoignable : le site reste utilisable.
const FALLBACK = { shop_name: 'Sira Yitte', tagline: 'Une caresse de cuir, un voyage de confort.', whatsapp_number: '221775857358',
  email: '', phone: '', address: 'Dakar, Sénégal', opening_hours: 'Lundi au samedi, 9h à 19h' };

/** Réglages de la boutique, zones de livraison et catégories (chargés une fois). */
export function ShopProvider({ children }) {
  const [state, setState] = useState({ shop: FALLBACK, zones: [], categories: [], ready: false, error: null });
  const [slow, setSlow] = useState(false);
  const load = useCallback(async () => {
    try {
      const [shop, zones, categories] = await Promise.all([api.shop(), api.zones(), api.categories()]);
      // Réponses inattendues (HTML, null, tableau à la place d'un objet...) : on refuse de les stocker,
      // sinon tout le site planterait au rendu (shop.whatsapp_number, zones.find, categories.map...).
      if (!shop || typeof shop !== 'object' || Array.isArray(shop)) {
        throw new ApiError(0, { detail: 'Le serveur a renvoyé des réglages de boutique invalides.' });
      }
      if (!Array.isArray(zones) || !Array.isArray(categories)) {
        throw new ApiError(0, { detail: 'Le serveur a renvoyé des données de livraison invalides.' });
      }
      setState({ shop: { ...FALLBACK, ...shop }, zones, categories, ready: true, error: null });
    } catch (error) {
      setState((s) => ({ ...s, ready: true, error }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  // Hébergement gratuit : le serveur peut mettre environ une minute à se réveiller après une période d'inactivité
  useEffect(() => {
    if (state.ready) { setSlow(false); return undefined; }
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [state.ready]);
  const value = useMemo(() => ({ ...state, slow, refresh: load }), [state, slow, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
