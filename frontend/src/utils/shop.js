import { TILES } from './constants';

export const tileStyle = (id) => ({ '--t1': TILES[id % 4][0], '--t2': TILES[id % 4][1] });
/** Modèle de brides de l'illustration de repli, déduit de l'identifiant. */
export const modelOf = (id) => (id % 3) + 1;

/** Totaux du panier ; le serveur les recalcule toujours à la commande. */
export function computeTotals(items, zone, mode = 'livraison') {
  const sub = items.reduce((a, i) => a + i.price * i.qty, 0);
  const pickup = mode === 'retrait';
  const liv = pickup || !zone || zone.fee == null ? 0 : zone.fee;
  return { sub, liv, tbc: !pickup && !!zone && zone.fee == null, total: sub + liv };
}
