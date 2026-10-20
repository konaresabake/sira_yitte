import { useEffect, useState } from 'react';
import { ErrorBox, Loader } from '../../components/Feedback';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useDebounce from '../../hooks/useDebounce';
import usePageTitle from '../../hooks/usePageTitle';
import { api, errorMessage } from '../../services/api';

/** Stock par taille et couleur : chaque modification est enregistrée aussitôt par l'API. */
export default function Stocks() {
  usePageTitle('Stocks');
  const toast = useToast();
  const [q, setQ] = useState('');
  const search = useDebounce(q, 350);
  // L'API plafonne à 100 produits par page : la recherche permet d'atteindre le reste du catalogue.
  const { data: list, error, reload } = useApi(() => api.admin.products({ page_size: 100, ordering: 'newest', search: search || undefined }), [search]);
  const [pid, setPid] = useState(null);
  const id = pid ?? list?.results[0]?.id;
  const { data: p, loading, error: detailError, reload: reloadDetail } = useApi(() => (id ? api.admin.product(id) : Promise.resolve(null)), [id]);
  const [variants, setVariants] = useState([]);
  useEffect(() => { if (p) setVariants(p.variants); }, [p]);

  const save = async (v, value) => {
    const stock = Math.max(0, Number(value) || 0);
    if (stock === v.stock) return;
    try {
      const out = await api.admin.updateVariant(v.id, stock);
      setVariants((vs) => vs.map((x) => (x.id === v.id ? { ...x, stock: out.stock, in_stock: out.stock > 0 } : x)));
      toast('Stock mis à jour');
    } catch (e) { toast(errorMessage(e)); reloadDetail(); }
  };
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!list) return <Loader />;
  const sizes = [...new Set(variants.map((v) => v.size))].sort((a, b) => a - b);
  const colors = [...new Map(variants.map((v) => [v.color, v])).values()];
  const cell = (c, s) => variants.find((v) => v.color === c.color && v.size === s);
  return (
    <>
      <h1>Stocks</h1><p className="sub">Quantité disponible par taille et par couleur.</p>
      <div className="box">
        <input type="search" placeholder="Rechercher un produit…" value={q} onChange={(e) => { setQ(e.target.value); setPid(null); }} aria-label="Rechercher un produit" style={{ maxWidth: 360, marginBottom: 10 }} />
        {list && list.count > list.results.length && (
          <p style={{ color: 'var(--mut)', margin: '0 0 10px', fontSize: '.9rem' }}>
            {list.count} produits au catalogue — utilisez la recherche pour afficher les suivants.
          </p>
        )}
        <select value={id ?? ''} onChange={(e) => setPid(Number(e.target.value))} style={{ maxWidth: 360, marginBottom: 16 }} aria-label="Produit">
          {list.results.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <ErrorBox error={detailError} onRetry={reloadDetail} />
        {loading && !p ? <Loader /> : (
          <div className="tw"><table>
            <thead><tr><th>Couleur / Taille</th>{sizes.map((s) => <th key={s} style={{ textAlign: 'center' }}>{s}</th>)}<th>Total</th></tr></thead>
            <tbody>{colors.map((c) => (
              <tr key={c.color}>
                <td><b><i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: c.hex_code, marginRight: 6 }} />{c.color_name}</b></td>
                {sizes.map((s) => { const v = cell(c, s); return (
                  <td key={s} style={{ textAlign: 'center' }}>{v ? <>
                    <input key={v.id + ':' + v.stock} className="stin" type="number" min="0" defaultValue={v.stock} onBlur={(e) => save(v, e.target.value)} aria-label={`${c.color_name} taille ${s}`} />
                    {v.stock === 0 && <div className="err" style={{ fontSize: '.7rem' }}>Rupture de stock</div>}</> : '–'}</td>
                ); })}
                <td><b>{variants.filter((v) => v.color === c.color).reduce((a, v) => a + v.stock, 0)}</b></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
