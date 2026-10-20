import { ErrorBox, Loader } from '../../components/Feedback';
import StatusBadge from '../../components/StatusBadge';
import useApi from '../../hooks/useApi';
import useCountUp from '../../hooks/useCountUp';
import usePageTitle from '../../hooks/usePageTitle';
import { api } from '../../services/api';
import { STATUSES } from '../../utils/constants';
import { dateShort, fmt } from '../../utils/format';

function Kpi({ value, label, money }) {
  const v = useCountUp(value);
  return <div><b>{money ? fmt(v) : v}</b><span>{label}</span></div>;
}

export default function Dashboard() {
  usePageTitle('Tableau de bord');
  const { data: d, error, reload } = useApi(() => api.admin.dashboard(), []);
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!d) return <Loader />;
  const days = d.sales_last_7_days, mx = Math.max(1, ...days.map((x) => x.revenue));
  return (
    <>
      <h1>Tableau de bord</h1><p className="sub">Vue d’ensemble de la boutique.</p>
      <div className="kp">
        <Kpi value={d.orders_count} label="Commandes" />
        <Kpi value={d.revenue} label="Chiffre d’affaires" money />
        <Kpi value={d.products_count} label="Produits" />
        <Kpi value={d.out_of_stock_products} label="Produits en rupture" />
        <Kpi value={d.new_orders} label="Commandes en attente" />
      </div>
      <div className="two2">
        <div className="box"><h3>Ventes des 7 derniers jours</h3>
          <div className="cols">{days.map((x, i) => <div key={x.date} title={`${fmt(x.revenue)} · ${x.orders} commande(s)`}><i style={{ height: Math.max(4, x.revenue / mx * 100) + '%', animationDelay: i * 80 + 'ms' }} />{new Date(x.date).toLocaleDateString('fr-FR', { weekday: 'short' })}</div>)}</div>
        </div>
        <div className="box"><h3>Commandes par statut</h3>
          {STATUSES.map(([v, label], i) => { const n = d.orders_by_status[v] || 0; return (
            <div className="hb" key={v}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><b>{n}</b></div><i style={{ width: (d.orders_count ? n / d.orders_count * 100 : 0) + '%', animationDelay: i * 90 + 'ms' }} /></div>
          ); })}
        </div>
      </div>
      <div className="two2">
        <div className="box"><h3 style={{ marginBottom: '.6rem' }}>Dernières commandes</h3>
          <div className="tw"><table><thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Total</th><th>Statut</th></tr></thead><tbody>
            {d.recent_orders.map((o) => <tr className="hv" key={o.id}><td><b>{o.number.slice(-9)}</b></td><td>{o.first_name} {o.last_name}</td><td>{dateShort(o.created_at)}</td><td>{fmt(o.total)}</td><td><StatusBadge status={o.status} /></td></tr>)}
          </tbody></table></div>
        </div>
        <div className="box"><h3 style={{ marginBottom: '.6rem' }}>Alertes de stock</h3>
          {d.low_stock.length ? d.low_stock.map((l) => <p key={l.variant} style={{ margin: '.3rem 0' }}>⚠ {l.product} · {l.color} T.{l.size} : {l.stock ? `${l.stock} restante${l.stock > 1 ? 's' : ''}` : 'rupture'}</p>) : <p>Tout est en stock.</p>}
          <h3 style={{ margin: '1.2rem 0 .6rem' }}>Meilleures ventes</h3>
          {d.top_products.length ? d.top_products.map((t) => <p key={t.product_id} style={{ margin: '.3rem 0' }}>{t.product_name} <b>× {t.quantity}</b></p>) : <p>Pas encore de ventes.</p>}
        </div>
      </div>
    </>
  );
}
