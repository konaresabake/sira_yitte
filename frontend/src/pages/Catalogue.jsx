import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorBox, GridSkeleton } from '../components/Feedback';
import Pagination from '../components/Pagination';
import ProductCard from '../components/ProductCard';
import { useShop } from '../context/ShopContext';
import useApi from '../hooks/useApi';
import useDebounce from '../hooks/useDebounce';
import usePageTitle from '../hooks/usePageTitle';
import { api } from '../services/api';
import { PAGE_SIZE, PRICE_MAX, SORTS } from '../utils/constants';
import { fmt, range } from '../utils/format';

/** Catalogue : les filtres vivent dans l'URL (partageable) et sont appliqués par l'API. */
export default function Catalogue() {
  usePageTitle('Catalogue');
  const { categories } = useShop();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(false);
  const f = {
    q: sp.get('q') || '', category: sp.get('category') || '', max: Number(sp.get('max')) || PRICE_MAX, size: Number(sp.get('size')) || 0,
    color: sp.get('color') || '', stock: sp.get('stock') === '1', sort: sp.get('sort') || 'popular', page: Number(sp.get('page')) || 1,
  };
  const update = (patch) => {
    // Forme fonctionnelle : si deux effets debouncés (recherche et prix) se déclenchent
    // dans le même commit, le second ne peut plus écraser le filtre du premier.
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => {
        const empty = v === '' || v == null || v === false || (k === 'max' && v >= PRICE_MAX) || (k === 'sort' && v === 'popular') || (k === 'page' && v === 1);
        if (empty) n.delete(k); else n.set(k, v === true ? '1' : v);
      });
      if (!('page' in patch)) n.delete('page');
      return n;
    }, { replace: true });
  };

  // champs à saisie continue : valeur locale, appliquée après une courte pause
  const [q, setQ] = useState(f.q);
  const [max, setMax] = useState(f.max);
  const dq = useDebounce(q, 350), dmax = useDebounce(max, 350);
  useEffect(() => { if (dq !== f.q) update({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (dmax !== f.max) update({ max: dmax }); }, [dmax]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setQ(f.q); }, [f.q]);
  useEffect(() => { setMax(f.max); }, [f.max]);

  const params = {
    category: f.category, price_max: f.max < PRICE_MAX ? f.max : undefined, size: f.size || undefined, color: f.color,
    in_stock: f.stock ? true : undefined, search: f.q, ordering: f.sort, page: f.page, page_size: PAGE_SIZE,
  };
  const { data, loading, error, reload } = useApi(() => api.products(params), [JSON.stringify(params)]);
  const { data: colors } = useApi(() => api.colors(), []);
  useEffect(() => { if (error?.status === 404 && f.page > 1) update({ page: 1 }); }, [error]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setSp({}, { replace: true }); setQ(''); setMax(PRICE_MAX); };

  return (
    <>
      <div className="pagehead"><div className="wrap"><h1>Toute la collection</h1><p>Sandales en cuir véritable, prix en FCFA.</p></div></div>
      <div className="wrap cat-l">
        <aside className={'fp' + (open ? ' open' : '')} aria-label="Filtres">
          <h4>Catégorie</h4>
          <div className="chips">
            <button className={'chip' + (f.category ? '' : ' on')} onClick={() => update({ category: '' })}>Toutes</button>
            {categories.map((c) => <button key={c.id} className={'chip' + (f.category === c.slug ? ' on' : '')} onClick={() => update({ category: c.slug })}>{c.name}</button>)}
          </div>
          <h4>Prix maximum : <span>{fmt(max)}</span></h4>
          <input type="range" min="10000" max={PRICE_MAX} step="500" value={max} onChange={(e) => setMax(+e.target.value)} aria-label="Prix maximum" />
          <h4>Taille</h4>
          <div className="chips">{range(36, 45).map((s) => <button key={s} className={'chip' + (f.size === s ? ' on' : '')} onClick={() => update({ size: f.size === s ? '' : s })}>{s}</button>)}</div>
          <h4>Couleur</h4>
          <div className="chips">
            {(colors || []).map((c) => <button key={c.id} className={'sw' + (f.color === c.name ? ' on' : '')} style={{ background: c.hex_code }} title={c.name} aria-label={c.name} onClick={() => update({ color: f.color === c.name ? '' : c.name })} />)}
          </div>
          <h4>Disponibilité</h4>
          <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={f.stock} onChange={(e) => update({ stock: e.target.checked })} /> En stock uniquement
          </label>
          <button className="btn b2 bs" style={{ marginTop: 16 }} onClick={reset}>Réinitialiser</button>
        </aside>
        <div>
          <div className="tool">
            <input type="search" placeholder="Rechercher une sandale, une couleur…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
            <select value={f.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Trier">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <button className="btn b4 bs fbtn" onClick={() => setOpen(!open)}>Filtres</button>
          </div>
          <ErrorBox error={error?.status === 404 ? null : error} onRetry={reload} />
          {data && <p style={{ color: 'var(--mut)', margin: '0 0 14px' }}>{data.count} modèle{data.count > 1 ? 's' : ''}</p>}
          {loading && !data ? <GridSkeleton /> : (
            <div className="grid" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }}>
              {data?.results.length ? data.results.map((p) => <div key={p.id} className="rv in"><ProductCard p={p} /></div>) : data && (
                <div className="empty" style={{ gridColumn: '1/-1' }}>
                  <h3>Aucune sandale trouvée</h3><p>Essayez d’élargir vos filtres.</p>
                  <button className="btn b4 bs" onClick={reset}>Réinitialiser les filtres</button>
                </div>
              )}
            </div>
          )}
          {data && <Pagination page={f.page} count={data.count} pageSize={PAGE_SIZE} onChange={(n) => { update({ page: n }); window.scrollTo({ top: 200, behavior: 'smooth' }); }} />}
        </div>
      </div>
    </>
  );
}
