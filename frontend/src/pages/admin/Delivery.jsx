import { useState } from 'react';
import { ErrorBox, Loader } from '../../components/Feedback';
import { useShop } from '../../context/ShopContext';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import usePageTitle from '../../hooks/usePageTitle';
import { api, errorMessage } from '../../services/api';

export default function Delivery() {
  usePageTitle('Livraison');
  const toast = useToast();
  const shopCtx = useShop();
  const { data: zones, error, reload } = useApi(() => api.zones(), []);
  const { data: shop, reload: reloadShop } = useApi(() => api.shop(), []);
  const [name, setName] = useState('');
  const run = async (fn, msg) => { try { await fn(); toast(msg); reload(); shopCtx.refresh(); return true; } catch (e) { toast(errorMessage(e)); return false; } };
  const saveShop = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try { await api.admin.updateShop({ ...fd, low_stock_threshold: Number(fd.low_stock_threshold) }); toast('Réglages enregistrés'); reloadShop(); shopCtx.refresh(); } catch (er) { toast(errorMessage(er)); }
  };
  return (
    <>
      <h1>Livraison</h1><p className="sub">Frais par zone. Laissez vide pour « À confirmer ».</p>
      <ErrorBox error={error} onRetry={reload} />
      {!zones ? <Loader /> : (
        <div className="box" style={{ maxWidth: 640 }}>
          {zones.map((z) => (
            <div key={z.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, opacity: z.is_active ? 1 : 0.55 }}>
              <b style={{ flex: 1 }}>{z.name}</b>
              <input key={z.id + ':' + z.fee} type="number" min="0" style={{ width: 130 }} defaultValue={z.fee ?? ''} placeholder="À confirmer" aria-label={`Frais ${z.name}`}
                onBlur={(e) => (e.target.value === String(z.fee ?? '') ? null : run(() => api.admin.updateZone(z.id, { fee: e.target.value === '' ? null : Number(e.target.value) }), 'Frais mis à jour'))} /><span>FCFA</span>
              <button className={'sw2' + (z.is_active ? ' on' : '')} onClick={() => run(() => api.admin.updateZone(z.id, { is_active: !z.is_active }), z.is_active ? 'Zone désactivée' : 'Zone activée')} aria-label={`Activer ${z.name}`} />
              <button className="ib bad" onClick={() => run(() => api.admin.deleteZone(z.id), 'Zone supprimée')} aria-label={`Supprimer ${z.name}`}>✕</button>
            </div>
          ))}
          <form style={{ display: 'flex', gap: 10, margin: '16px 0' }} onSubmit={async (e) => { e.preventDefault(); if (name.trim() && await run(() => api.admin.createZone({ name: name.trim(), fee: null }), 'Zone ajoutée')) setName(''); }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle zone" aria-label="Nouvelle zone" /><button className="btn b1" type="submit">Ajouter</button>
          </form>
        </div>
      )}
      {shop && (
        <form className="box" style={{ maxWidth: 640, marginTop: 18 }} onSubmit={saveShop} key={shop.whatsapp_number + shop.email}>
          <h3 style={{ marginBottom: '1rem' }}>Coordonnées de la boutique</h3>
          <div className="fg">
            <div className="f"><label htmlFor="wan">Numéro WhatsApp (format international, sans +)</label><input id="wan" name="whatsapp_number" defaultValue={shop.whatsapp_number} /></div>
            <div><label htmlFor="se">E-mail (reçoit les nouvelles commandes)</label><input id="se" name="email" type="email" defaultValue={shop.email} /></div>
            <div><label htmlFor="sp">Téléphone</label><input id="sp" name="phone" defaultValue={shop.phone} /></div>
            <div><label htmlFor="sa">Adresse</label><input id="sa" name="address" defaultValue={shop.address} /></div>
            <div><label htmlFor="sh">Horaires</label><input id="sh" name="opening_hours" defaultValue={shop.opening_hours} /></div>
            <div><label htmlFor="st">Seuil d'alerte de stock</label><input id="st" name="low_stock_threshold" type="number" min="0" defaultValue={shop.low_stock_threshold} /></div>
          </div>
          <div className="acts"><button className="btn b1" type="submit">Enregistrer</button></div>
        </form>
      )}
    </>
  );
}
