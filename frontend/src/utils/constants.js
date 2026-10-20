/** Couleurs de repli (illustrations) ; les vraies couleurs viennent de l'API (hex_code). */
export const COLORS = { Marron: '#7a4a2a', Noir: '#221a15', Beige: '#d6bc93', Miel: '#c8893a', Camel: '#b07a45', Bordeaux: '#6b2a2a', Gris: '#8d8a86' };
export const TILES = [['#f5e2c4', '#e3c28f'], ['#e6d3bd', '#c9a67c'], ['#f1dcc0', '#d9b27c'], ['#ead7c3', '#bf9a72']];
/** Statuts de commande : [valeur envoyée par l'API, libellé]. */
export const STATUSES = [['nouvelle', 'Nouvelle'], ['confirmee', 'Confirmée'], ['preparation', 'En préparation'], ['expediee', 'Expédiée'], ['livree', 'Livrée'], ['annulee', 'Annulée']];
export const statusLabel = (s) => STATUSES.find((x) => x[0] === s)?.[1] || s;
export const statusIndex = (s) => STATUSES.findIndex((x) => x[0] === s);
export const SORTS = [['popular', 'Produits populaires'], ['newest', 'Nouveautés'], ['price_asc', 'Prix croissant'], ['price_desc', 'Prix décroissant']];
export const PRICE_MAX = 30000;
export const PAGE_SIZE = 6;
export const MARQUEE = ['Cuir véritable', 'Fabrication artisanale', 'Qualité garantie', 'Livraison disponible', 'Commande facile'];
/** Zooms utilisés quand un produit n'a qu'une seule photo : [échelle, origine]. */
export const PHOTO_ZOOMS = [[2, '45% 45%'], [2.2, '72% 62%']];
