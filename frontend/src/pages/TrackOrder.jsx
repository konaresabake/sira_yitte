import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorBox } from '../components/Feedback';
import StatusBadge from '../components/StatusBadge';
import usePageTitle from '../hooks/usePageTitle';
import { ApiError, api } from '../services/api';
import { STATUSES, statusIndex } from '../utils/constants';
import { fmt } from '../utils/format';

/** Suivi public d'une commande : numéro + téléphone (aucune donnée personnelle affichée). */
export default function TrackOrder() {
  usePageTitle('Suivre ma commande');
  const [sp] = useSearchParams();
  const [number, setNumber] = useState(sp.get('number') || '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setOrder(null);
    try { setOrder(await api.trackOrder(number.trim(), phone.trim())); } catch (er) { setError(er.status === 404 ? new ApiError(404, { detail: 'Aucune commande ne correspond à ce numéro et ce téléphone.' }) : er); } finally { setBusy(false); }
  };
  const idx = order ? statusIndex(order.status) : -1;
  return (
    <>
      <div className="pagehead"><div className="wrap"><h1>Suivre ma commande</h1><p>Entrez votre numéro de commande et le téléphone utilisé.</p></div></div>
      <div className="wrap trk" style={{ padding: '36px 20px 70px' }}>
        <form className="box" onSubmit={submit}>
          <div className="fg">
            <div><label htmlFor="tn">Numéro de commande</label><input id="tn" placeholder="CMD-2026-00001" value={number} onChange={(e) => setNumber(e.target.value)} required /></div>
            <div><label htmlFor="tp">Téléphone</label><input id="tp" type="tel" placeholder="77 000 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
          </div>
          <div className="acts"><button className="btn b1" disabled={busy}>{busy ? 'Recherche…' : 'Voir le statut'}</button></div>
        </form>
        <div style={{ marginTop: 20 }}><ErrorBox error={error} /></div>
        {order && (
          <div className="box" style={{ marginTop: 20, animation: 'vin .4s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}><h3>Commande #{order.number}</h3><StatusBadge status={order.status} /></div>
            {order.status !== 'annulee' && <>
              <div className="stp">{STATUSES.slice(0, 5).map(([v], i) => <i key={v} className={i <= idx ? 'on' : ''} />)}</div>
              <div className="lbls">{STATUSES.slice(0, 5).map(([v, l]) => <span key={v}>{l}</span>)}</div>
            </>}
            <div style={{ marginTop: 16 }}>
              {order.items.map((i) => <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{i.quantity} × {i.product_name} (T.{i.size}, {i.color_name})</span><span>{fmt(i.line_total)}</span></div>)}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--mut)' }}><span>Livraison</span><span>{order.delivery_fee_to_confirm ? 'À confirmer' : fmt(order.delivery_fee)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.15rem', marginTop: 6 }}><span>Total</span><span>{fmt(order.total)}</span></div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
