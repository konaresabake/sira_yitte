import { useState } from 'react';
import { ErrorBox, Loader } from '../../components/Feedback';
import Pagination from '../../components/Pagination';
import useApi from '../../hooks/useApi';
import useDebounce from '../../hooks/useDebounce';
import usePageTitle from '../../hooks/usePageTitle';
import { api } from '../../services/api';
import { fmt } from '../../utils/format';

const SIZE = 12;

export default function Customers() {
  usePageTitle('Clients');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounce(q, 350);
  const { data, loading, error, reload } = useApi(() => api.admin.customers({ search, page, page_size: SIZE }), [search, page]);
  return (
    <>
      <h1>Clients</h1><p className="sub">{data ? `${data.count} client${data.count > 1 ? 's' : ''} ayant commandé.` : ' '}</p>
      <div className="tool"><input type="search" placeholder="Nom ou téléphone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Rechercher un client" /></div>
      <ErrorBox error={error} onRetry={reload} />
      {!data && loading ? <Loader /> : data && (
        <div className="box tw"><table>
          <thead><tr><th>Client</th><th>Téléphone</th><th>Commandes</th><th>Total dépensé</th></tr></thead>
          <tbody>{data.results.map((c) => <tr className="hv" key={c.phone}><td><b>{c.first_name} {c.last_name}</b></td><td>{c.phone}</td><td>{c.orders_count}</td><td>{fmt(c.total_spent)}</td></tr>)}</tbody>
        </table><Pagination page={page} count={data.count} pageSize={SIZE} onChange={setPage} /></div>
      )}
    </>
  );
}
