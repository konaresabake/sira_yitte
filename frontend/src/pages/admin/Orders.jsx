import { useState } from 'react';
import { ErrorBox, Loader } from '../../components/Feedback';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useDebounce from '../../hooks/useDebounce';
import usePageTitle from '../../hooks/usePageTitle';
import { api, errorMessage } from '../../services/api';
import { STATUSES, statusIndex, statusLabel } from '../../utils/constants';
import { dateShort, fmt } from '../../utils/format';
import { waNumber } from '../../utils/whatsapp';

const SIZE = 10;

export default function Orders() {
  usePageTitle('Commandes');
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const search = useDebounce(q, 350);
  const { data, loading, error, reload } = useApi(() => api.admin.orders({ status, search, page, page_size: SIZE }), [status, search, page]);

  const change = async (o, patch) => {
    try { await api.admin.updateOrder(o.id, patch); toast(patch.status ? `Statut : ${statusLabel(patch.status)}` : 'Notes enregistrées'); reload(); } catch (e) { toast(errorMessage(e)); }
  };
  const pick = (s) => { setStatus(s); setPage(1); };
  return (
    <>
      <h1>Commandes</h1><p className="sub">Suivez et mettez à jour le statut.</p>
      <div className="tool"><input type="search" placeholder="Numéro, nom ou téléphone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Rechercher une commande" /></div>
      <div className="chips" style={{ marginBottom: 16 }}>
        <button className={'chip' + (status ? '' : ' on')} onClick={() => pick('')}>Toutes</button>
        {STATUSES.map(([v, l]) => <button key={v} className={'chip' + (status === v ? ' on' : '')} onClick={() => pick(v)}>{l}</button>)}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {!data && loading ? <Loader /> : data && (
        <div className="box" style={{ opacity: loading ? 0.6 : 1 }}>
          {data.results.length ? data.results.map((o) => {
            const op = open === o.id, idx = statusIndex(o.status);
            return (
              <div key={o.id} style={{ borderBottom: '1px solid var(--line)', padding: '.8rem 0' }}>
                <button onClick={() => setOpen(op ? null : o.id)} style={{ width: '100%', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', textAlign: 'left' }} aria-expanded={op}>
                  <b style={{ minWidth: 110 }}>#{o.number.slice(-9)}</b><span style={{ flex: 1 }}>{o.first_name} {o.last_name}</span><span>{dateShort(o.created_at)}</span><b>{fmt(o.total)}</b><StatusBadge status={o.status} />
                </button>
                {op && (
                  <div style={{ animation: 'vin .3s', paddingTop: 12 }}>
                    <div className="stp">{STATUSES.slice(0, 5).map(([v, l], i) => <i key={v} className={o.status !== 'annulee' && i <= idx ? 'on' : ''} title={l} />)}</div>
                    <p style={{ margin: '.3rem 0' }}><b>{o.first_name} {o.last_name}</b> · {o.phone}{o.email && ` · ${o.email}`}<br />{o.address || 'Retrait en boutique'}{o.zone_name && ` (${o.zone_name})`} · {o.delivery_mode_label}{o.notes && <><br /><i>{o.notes}</i></>}</p>
                    {o.items.map((i) => <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{i.quantity} × {i.product_name} (T.{i.size}, {i.color_name})</span><span>{fmt(i.line_total)}</span></div>)}
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--mut)' }}><span>Livraison</span><span>{o.delivery_fee_to_confirm ? 'À confirmer' : fmt(o.delivery_fee)}</span></div>
                    <div className="acts">
                      {o.allowed_next_statuses.length > 0 && (
                        <select value="" onChange={(e) => e.target.value && change(o, { status: e.target.value })} style={{ width: 'auto' }} aria-label="Changer le statut">
                          <option value="">Changer le statut…</option>
                          {o.allowed_next_statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                        </select>
                      )}
                      <a className="btn b3 bs" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${waNumber(o.phone)}?text=${encodeURIComponent(`Bonjour ${o.first_name}, votre commande #${o.number} est : ${o.status_label}.`)}`}>Contacter le client</a>
                    </div>
                    <label style={{ marginTop: 14 }} htmlFor={`n${o.id}`}>Notes internes</label>
                    <textarea id={`n${o.id}`} rows="2" defaultValue={o.admin_notes} onBlur={(e) => e.target.value !== o.admin_notes && change(o, { admin_notes: e.target.value })} />
                    {o.events.length > 0 && <p style={{ color: 'var(--mut)', fontSize: '.85rem', margin: '.8rem 0 0' }}>Historique : {o.events.map((ev) => `${ev.to_label} (${dateShort(ev.created_at)})`).join(' → ')}</p>}
                  </div>
                )}
              </div>
            );
          }) : <p className="empty">Aucune commande trouvée.</p>}
          <Pagination page={page} count={data.count} pageSize={SIZE} onChange={setPage} />
        </div>
      )}
    </>
  );
}
