import { useState } from 'react';
import { ErrorBox, Loader } from '../../components/Feedback';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import Pic from '../../components/Pic';
import { useShop } from '../../context/ShopContext';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useDebounce from '../../hooks/useDebounce';
import usePageTitle from '../../hooks/usePageTitle';
import { ApiError, api, errorMessage } from '../../services/api';
import { fmt, range } from '../../utils/format';
import { tileStyle } from '../../utils/shop';

const SIZE = 15;

export default function Products() {
  usePageTitle('Produits');
  const toast = useToast();
  const shop = useShop();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // { type: 'form' | 'del', p? }
  const search = useDebounce(q, 350);
  const { data, loading, error, reload } = useApi(() => api.admin.products({ search, page, page_size: SIZE, ordering: 'newest' }), [search, page]);

  const patch = async (p, body, msg) => {
    try { await api.admin.updateProduct(p.id, body); toast(msg); reload(); } catch (e) { toast(errorMessage(e)); }
  };
  const del = async (p) => {
    try { await api.admin.deleteProduct(p.id); toast('Produit supprimé'); setModal(null); reload(); } catch (e) { toast(errorMessage(e)); }
  };
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: 10 }}>
        <div><h1>Produits</h1><p className="sub">{data ? `${data.count} produit${data.count > 1 ? 's' : ''}` : ' '}</p></div>
        <button className="btn b1" onClick={() => setModal({ type: 'form' })}>Ajouter un produit</button>
      </div>
      <div className="tool"><input type="search" placeholder="Rechercher un produit…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Rechercher un produit" /></div>
      <ErrorBox error={error} onRetry={reload} />
      {!data && loading ? <Loader /> : data && (
        <div className="box tw" style={{ opacity: loading ? 0.6 : 1 }}><table>
          <thead><tr><th></th><th>Nom</th><th>Catégorie</th><th>Prix</th><th>Stock</th><th>Vedette</th><th>Actif</th><th></th></tr></thead>
          <tbody>{data.results.map((p) => (
            <tr className="hv" key={p.id}>
              <td><div className="th" style={tileStyle(p.id)}><Pic p={p} hex={p.colors[0]?.hex_code} /></div></td>
              <td><b>{p.name}</b></td><td>{p.category.name}</td>
              <td>{fmt(p.price)}{p.old_price ? <><br /><s style={{ color: 'var(--mut)' }}>{fmt(p.old_price)}</s></> : null}</td>
              <td>{p.total_stock || <span className="out">Rupture</span>}</td>
              <td><button className="ib" onClick={() => patch(p, { is_featured: !p.is_featured }, p.is_featured ? 'Retiré des vedettes' : 'Produit mis en vedette')} aria-label={`Vedette ${p.name}`}>{p.is_featured ? '★' : '☆'}</button></td>
              <td><button className={'sw2' + (p.is_active ? ' on' : '')} onClick={() => patch(p, { is_active: !p.is_active }, p.is_active ? 'Produit désactivé' : 'Produit activé')} aria-label={`Actif ${p.name}`} /></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="ib" onClick={() => setModal({ type: 'form', p })} aria-label={`Modifier ${p.name}`}>✎</button>{' '}
                <button className="ib bad" onClick={() => setModal({ type: 'del', p })} aria-label={`Supprimer ${p.name}`}>✕</button>
              </td>
            </tr>
          ))}</tbody>
        </table>{!data.results.length && <p className="empty">Aucun produit trouvé.</p>}<Pagination page={page} count={data.count} pageSize={SIZE} onChange={setPage} /></div>
      )}
      {modal?.type === 'form' && <ProductForm id={modal.p?.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); shop.refresh(); }} />}
      {modal?.type === 'del' && (
        <Modal onClose={() => setModal(null)}>
          <h3>Supprimer ce produit ?</h3><p>« {modal.p.name} » sera retiré du catalogue. L'historique des commandes est conservé.</p>
          <div className="acts"><button className="btn b4" onClick={() => del(modal.p)}>Supprimer</button><button className="btn b2" onClick={() => setModal(null)}>Annuler</button></div>
        </Modal>
      )}
    </>
  );
}

/** Formulaire produit : informations, couleurs x tailles (variantes) et images. */
function ProductForm({ id, onClose, onSaved }) {
  const toast = useToast();
  const { data: cats } = useApi(() => api.categories(), []);
  const { data: colors } = useApi(() => api.colors(), []);
  const { data: p, error: loadError } = useApi(() => (id ? api.admin.product(id) : Promise.resolve(null)), [id]);
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState(null);
  if (loadError) return <Modal onClose={onClose}><ErrorBox error={loadError} /></Modal>;
  if (!cats || !colors || (id && !p)) return <Modal onClose={onClose}><Loader /></Modal>;
  const p0 = p || { name: '', description: '', material: 'Cuir de vache véritable', price: '', old_price: null, category: { id: cats[0]?.id }, variants: [], is_active: true, is_featured: false, popularity: 0, images: [] };
  const sizesNow = [...new Set(p0.variants.map((v) => v.size))].sort((a, b) => a - b);
  const colorsNow = new Set(p0.variants.map((v) => v.color));
  const imgs = images || p0.images;

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target), cols = fd.getAll('col').map(Number), er = {};
    if (!String(fd.get('name')).trim()) er.name = 'Le nom est requis';
    if (!(Number(fd.get('price')) > 0)) er.price = 'Prix invalide';
    if (!cols.length) er.col = 'Choisissez une couleur';
    const s1 = Number(fd.get('s1')), s2 = Number(fd.get('s2'));
    if (!(s1 >= 20 && s2 >= s1 && s2 <= 60)) er.sizes = 'Plage de tailles invalide';
    setErrors(er); setApiErr(null);
    if (Object.keys(er).length) return;
    const existing = new Map(p0.variants.map((v) => [`${v.color}|${v.size}`, v.stock]));
    const body = {
      name: String(fd.get('name')).trim(), description: fd.get('desc'), material: fd.get('mat'), category: Number(fd.get('cat')),
      price: Number(fd.get('price')), old_price: fd.get('old') ? Number(fd.get('old')) : null, popularity: Number(fd.get('pop')) || 0,
      is_featured: !!fd.get('feat'), is_active: !!fd.get('actif'),
      variants: cols.flatMap((c) => range(s1, s2).map((s) => ({ color: c, size: s, stock: existing.get(`${c}|${s}`) ?? 5 }))),
    };
    setBusy(true);
    try {
      const saved = id ? await api.admin.updateProduct(id, body) : await api.admin.createProduct(body);
      for (const f of files) await api.admin.uploadImage(saved.id, f);
      toast(id ? 'Produit modifié' : 'Produit ajouté');
      onSaved();
    } catch (er) {
      setBusy(false);
      if (er instanceof ApiError && er.status === 400) { const m = {}; Object.entries(er.fields).forEach(([k, v]) => { m[k] = v[0]; }); setErrors(m); }
      setApiErr(er);
    }
  };
  const removeImage = async (im) => { try { await api.admin.deleteImage(im.id); setImages(imgs.filter((x) => x.id !== im.id)); } catch (er) { toast(errorMessage(er)); } };
  const mainImage = async (im) => { try { await api.admin.updateImage(im.id, { is_main: true }); setImages(imgs.map((x) => ({ ...x, is_main: x.id === im.id }))); } catch (er) { toast(errorMessage(er)); } };

  return (
    <Modal onClose={onClose}>
      <h3>{id ? 'Modifier le produit' : 'Nouveau produit'}</h3>
      <form onSubmit={submit} noValidate>
        <ErrorBox error={apiErr && Object.keys(errors).length === 0 ? apiErr : null} />
        <div className="fg">
          <div className="f"><label htmlFor="pn">Nom</label><input id="pn" name="name" defaultValue={p0.name} /><div className="err">{errors.name}</div></div>
          <div className="f"><label htmlFor="pd">Description</label><textarea id="pd" name="desc" rows="2" defaultValue={p0.description} /></div>
          <div><label htmlFor="pp">Prix (FCFA)</label><input id="pp" name="price" type="number" min="0" defaultValue={p0.price} /><div className="err">{errors.price}</div></div>
          <div><label htmlFor="po">Ancien prix</label><input id="po" name="old" type="number" min="0" defaultValue={p0.old_price || ''} /><div className="err">{errors.old_price}</div></div>
          <div><label htmlFor="pc">Catégorie</label><select id="pc" name="cat" defaultValue={p0.category.id}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label htmlFor="pq">Popularité (ordre d'affichage)</label><input id="pq" name="pop" type="number" min="0" defaultValue={p0.popularity} /></div>
          <div className="f"><label htmlFor="pm">Matière</label><input id="pm" name="mat" defaultValue={p0.material} /></div>
          <div className="f"><label>Couleurs</label>
            <div className="cbs">{colors.map((c) => (
              <label key={c.id}><input type="checkbox" name="col" value={c.id} defaultChecked={colorsNow.has(c.id) || (!id && c.name === 'Marron')} /><i style={{ width: 14, height: 14, borderRadius: '50%', background: c.hex_code }} />{c.name}</label>
            ))}</div><div className="err">{errors.col}</div></div>
          <div><label htmlFor="s1">Taille min</label><input id="s1" name="s1" type="number" defaultValue={sizesNow[0] ?? 38} /></div>
          <div><label htmlFor="s2">Taille max</label><input id="s2" name="s2" type="number" defaultValue={sizesNow[sizesNow.length - 1] ?? 44} /></div>
          <div className="f err">{errors.sizes || errors.variants}</div>
          <div className="f cbs">
            <label><input type="checkbox" name="feat" defaultChecked={p0.is_featured} /> Produit vedette</label>
            <label><input type="checkbox" name="actif" defaultChecked={p0.is_active} /> Produit actif</label>
          </div>
          <div className="f"><label htmlFor="pi">Images (JPG, PNG ou WebP, 5 Mo max, compressées automatiquement)</label>
            {imgs.length > 0 && <div className="imgs">{imgs.map((im) => (
              <figure key={im.id} className={im.is_main ? 'main' : ''}><img src={im.image} alt={im.alt_text} />
                <button type="button" onClick={() => removeImage(im)} aria-label="Supprimer l'image">✕</button>
                {!im.is_main && <button type="button" className="star" onClick={() => mainImage(im)} aria-label="Définir comme image principale">★</button>}</figure>
            ))}</div>}
            <input id="pi" type="file" accept="image/*" multiple onChange={(e) => setFiles([...e.target.files])} /><div className="err">{errors.image}</div></div>
          {id && <p className="f" style={{ color: 'var(--mut)', fontSize: '.85rem', margin: 0 }}>Les stocks existants sont conservés. Réduire la plage de tailles ou décocher une couleur supprime ces variantes.</p>}
        </div>
        <div className="acts"><button className="btn b1" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button><button className="btn b2" type="button" onClick={onClose}>Annuler</button></div>
      </form>
    </Modal>
  );
}
