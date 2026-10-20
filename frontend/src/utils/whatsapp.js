import { fmt } from './format';
export const openWhatsApp = (number, text) =>
  window.open('https://wa.me/' + number + (text ? '?text=' + encodeURIComponent(text) : ''), '_blank', 'noopener');
/** Numéro international sans « + » : un numéro local sénégalais (9 chiffres) reçoit l'indicatif 221. */
export const waNumber = (raw) => {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length === 9 ? '221' + d : d;
};
export const linesMessage = (lines) =>
  lines.map((l) => `- ${l.p.name}\n  Taille : ${l.it.size}\n  Couleur : ${l.it.color}\n  Quantité : ${l.it.qty}\n  Prix : ${fmt(l.line)}`).join('\n');
