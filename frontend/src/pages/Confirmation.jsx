import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import { fmt } from '../utils/format';

function confetti(created, timers) {
  const cs = ['#daa949', '#f2c665', '#7a3f1d', '#2f8f5b', '#fff'];
  for (let i = 0; i < 46; i++) {
    const d = document.createElement('i');
    d.className = 'cf';
    d.style.cssText = `left:${Math.random() * 100}vw;background:${cs[i % 5]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2.2 + Math.random() * 2}s`;
    document.body.appendChild(d);
    created.push(d);
    timers.push(setTimeout(() => d.remove(), 5000));
  }
}

function lastOrder(number) {
  try { const o = JSON.parse(sessionStorage.getItem('sira-last-order')); return o?.number === number ? o : null; } catch { return null; }
}

/** Confirmation : la commande vient de la réponse de l'API (conservée pour un rechargement de page). */
export default function Confirmation() {
  usePageTitle('Commande reçue');
  const { number } = useParams();
  const { state } = useLocation();
  const o = state?.order?.number === number ? state.order : lastOrder(number);
  useEffect(() => {
    if (!o) return undefined;
    const created = [];
    const timers = [];
    const t = setTimeout(() => confetti(created, timers), 300);
    return () => { // au démontage : on annule les timers et on retire les nœuds restants du DOM
      clearTimeout(t);
      timers.forEach(clearTimeout);
      created.forEach((d) => d.remove());
    };
  }, [o?.number]); // eslint-disable-line
  if (!o) return (
    <div className="wrap empty" style={{ padding: '80px 0' }}>
      <h2>Retrouvez votre commande {number}</h2><p>Pour des raisons de confidentialité, indiquez votre téléphone pour la consulter.</p>
      <Link className="btn b1" to={`/suivi?number=${number}`}>Suivre ma commande</Link>
    </div>
  );
  return (
    <div className="wrap done">
      <svg className="ck" viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" /><path d="M38 62l16 16 30-34" /></svg>
      <h1 style={{ marginTop: 14 }}>Merci {o.first_name}, commande reçue !</h1>
      <div className="num">Commande #{o.number}</div>
      <div className="tl">
        <div>Notification envoyée au vendeur</div>
        <div>{o.email ? `Confirmation envoyée à ${o.email}` : `Nous vous contactons au ${o.phone}`}</div>
        <div>Total à régler : {fmt(o.total)}{o.delivery_fee_to_confirm ? ' (frais de livraison à confirmer)' : ''}</div>
      </div>
      <div className="acts" style={{ justifyContent: 'center' }}>
        <button className="btn b3" onClick={() => window.open(o.whatsapp_url, '_blank', 'noopener')}>Suivre sur WhatsApp</button>
        <Link className="btn b4" to={`/suivi?number=${o.number}`}>Suivre ma commande</Link>
        <Link className="btn b2" style={{ color: 'var(--tx)' }} to="/catalogue">Continuer mes achats</Link>
      </div>
    </div>
  );
}
