export const fmt = (n) => Number(n).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ') + ' FCFA';
export const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
export const slugify = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Éclaircit (a>0) ou assombrit (a<0) une couleur hexadécimale. */
export const shade = (h, a) =>
  '#' + h.slice(1).match(/../g).map((x) => Math.max(0, Math.min(255, parseInt(x, 16) + a)).toString(16).padStart(2, '0')).join('');
export const dateShort = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
export const phoneOk = (v) => { const d = String(v).replace(/\D/g, ''); return d.length >= 9 && d.length <= 12; };
