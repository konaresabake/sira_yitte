import { useState } from 'react';
import { ErrorBox, Loader } from '../../components/Feedback';
import Modal from '../../components/Modal';
import { useShop } from '../../context/ShopContext';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import usePageTitle from '../../hooks/usePageTitle';
import { api, errorMessage } from '../../services/api';

export default function Categories() {
  usePageTitle('Catégories');
  const toast = useToast();
  const shop = useShop();
  const { data, error, reload } = useApi(() => api.categories(), []);
  const [name, setName] = useState('');
  const [edit, setEdit] = useState(null);
  const done = (msg) => { toast(msg); reload(); shop.refresh(); };
  const run = async (fn, msg) => { try { await fn(); done(msg); return true; } catch (e) { toast(errorMessage(e)); return false; } };
  return (
    <>
      <h1>Catégories</h1><p className="sub">Organisez votre catalogue.</p>
      <ErrorBox error={error} onRetry={reload} />
      {!data ? <Loader /> : (
        <div className="box" style={{ maxWidth: 640 }}>
          <form style={{ display: 'flex', gap: 10, marginBottom: 16 }} onSubmit={async (e) => { e.preventDefault(); if (name.trim() && await run(() => api.admin.createCategory({ name: name.trim() }), 'Catégorie ajoutée')) setName(''); }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle catégorie" aria-label="Nouvelle catégorie" /><button className="btn b1" type="submit">Ajouter</button>
          </form>
          {data.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '.7rem 0', borderBottom: '1px solid var(--line)', opacity: c.is_active ? 1 : 0.55 }}>
              <b style={{ flex: 1 }}>{c.name}{!c.is_active && ' (masquée)'}</b><span style={{ color: 'var(--mut)' }}>{c.products_count} produit{c.products_count > 1 ? 's' : ''}</span>
              <button className="ib" onClick={() => setEdit(c)} aria-label={`Modifier ${c.name}`}>✎</button>
              <button className="ib bad" onClick={() => run(() => api.admin.deleteCategory(c.id), 'Catégorie supprimée')} aria-label={`Supprimer ${c.name}`}>✕</button>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal onClose={() => setEdit(null)}>
          <h3>Modifier la catégorie</h3>
          <form onSubmit={async (e) => { e.preventDefault(); if (edit.name.trim() && await run(() => api.admin.updateCategory(edit.id, { name: edit.name.trim(), description: edit.description, is_active: edit.is_active }), 'Catégorie modifiée')) setEdit(null); }}>
            <label htmlFor="cn">Nom</label><input id="cn" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <label htmlFor="cd" style={{ marginTop: 10 }}>Description</label><textarea id="cd" rows="2" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginTop: 10 }}><input type="checkbox" style={{ width: 'auto' }} checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> Visible sur le site</label>
            <div className="acts"><button className="btn b1" type="submit">Enregistrer</button><button className="btn b2" type="button" onClick={() => setEdit(null)}>Annuler</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
