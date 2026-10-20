import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBox, ErrorList } from '../components/Feedback';
import { useCart } from '../context/CartContext';
import { useShop } from '../context/ShopContext';
import usePageTitle from '../hooks/usePageTitle';
import { ApiError, api } from '../services/api';
import { fmt, phoneOk } from '../utils/format';
import { openWhatsApp } from '../utils/whatsapp';
import Cart, { cartMessage } from './Cart';

export default function Checkout() {
  usePageTitle('Commande');
  const cart = useCart();
  const { zones, shop } = useShop();
  const nav = useNavigate();
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', email: '', address: '', notes: '', mode: 'livraison' });
  const [err, setErr] = useState({});
  const [apiError, setApiError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const shakeTimer = useRef();
  useEffect(() => () => clearTimeout(shakeTimer.current), []);
  useEffect(() => { cart.sync(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cart.items.length && !busy) return <Cart />;
  const t = cart.totals(f.mode);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const fail = (er) => {
    setErr(er);
    setShake(true);
    clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShake(false), 450);
  };

  const placeOrder = async (viaWhatsApp) => {
    const er = {};
    if (!f.first_name.trim()) er.first_name = 'Indiquez votre prénom';
    if (!f.last_name.trim()) er.last_name = 'Indiquez votre nom';
    if (!phoneOk(f.phone)) er.phone = 'Numéro invalide (9 chiffres minimum)';
    if (f.mode === 'livraison' && !f.address.trim()) er.address = 'Indiquez votre adresse';
    setApiError(null);
    if (Object.keys(er).length) { fail(er); return; }
    setErr({});
    setBusy(true);

    try {
      const notesArr = [f.notes.trim()];
      if (viaWhatsApp) notesArr.push('Commande envoyée via WhatsApp.');
      const order = await api.createOrder({
        first_name: f.first_name.trim(), last_name: f.last_name.trim(), phone: f.phone.trim(), email: f.email.trim(),
        address: f.address.trim(), notes: notesArr.filter(Boolean).join('\n'), delivery_mode: f.mode, zone: f.mode === 'livraison' ? cart.zoneId : null,
        items: cart.items.map((i) => ({ variant: i.variantId, quantity: i.qty })),
      });
      try { sessionStorage.setItem('sira-last-order', JSON.stringify(order)); } catch { /* ignore */ }
      cart.clear();

      if (viaWhatsApp && shop.whatsapp_number) {
        const extra = `Nom : ${order.first_name} ${order.last_name}\nTéléphone : ${order.phone}\nAdresse : ${order.address || 'Retrait en boutique'}, ${order.zone_name || ''}\nRéférence commande : ${order.number} (enregistrée sur le site)`;
        const msg = cartMessage(cart.items, t.total, extra);
        try {
          window.open('https://wa.me/' + shop.whatsapp_number + (msg ? '?text=' + encodeURIComponent(msg) : ''), '_blank', 'noopener,noreferrer');
        } catch {
          openWhatsApp(shop.whatsapp_number, msg);
        }
      }

      nav(`/confirmation/${order.number}`, { state: { order } });
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.status === 400) {
        const fields = error.fields;
        fail(Object.fromEntries(Object.entries(fields).filter(([k]) => k !== 'items').map(([k, v]) => [k, v[0]])));
        if (fields.items || fields.non_field_errors) { setApiError({ items: fields.items || fields.non_field_errors }); cart.sync(); }
      } else setApiError({ error });
    }
  };

  const submit = (e) => { e.preventDefault(); try { window.localStorage.removeItem('sira-wa'); } catch {} placeOrder(false); };
  const wa = () => placeOrder(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem('sira-wa') === '1') {
        window.localStorage.removeItem('sira-wa');
        // Ne pas déclencher automatiquement : certains navigateurs bloquent les popups sans geste direct.
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-dep

  return (
    <>
      <div className="pagehead"><div className="wrap"><h1>Finaliser la commande</h1><p>Paiement à la livraison ou selon les modalités du vendeur.</p></div></div>
      <div className="wrap cl">
        <form className={'box' + (shake ? ' shake' : '')} onSubmit={submit} noValidate>
          <ErrorList messages={apiError?.items} />
          <ErrorBox error={apiError?.error} />
          <div className="fg">
            <div><label htmlFor="pr">Prénom</label><input id="pr" value={f.first_name} onChange={on('first_name')} autoComplete="given-name" /><div className="err">{err.first_name}</div></div>
            <div><label htmlFor="nm">Nom</label><input id="nm" value={f.last_name} onChange={on('last_name')} autoComplete="family-name" /><div className="err">{err.last_name}</div></div>
            <div><label htmlFor="tl">Téléphone</label><input id="tl" type="tel" placeholder="77 000 00 00" value={f.phone} onChange={on('phone')} autoComplete="tel" /><div className="err">{err.phone}</div></div>
            <div><label htmlFor="em">E-mail (facultatif)</label><input id="em" type="email" placeholder="pour la confirmation" value={f.email} onChange={on('email')} autoComplete="email" /><div className="err">{err.email}</div></div>
            {f.mode === 'livraison' && <>
              <div><label htmlFor="zz">Ville / quartier</label><select id="zz" value={cart.zoneId ?? ''} onChange={(e) => cart.setZone(Number(e.target.value))}>{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select><div className="err">{err.zone}</div></div>
              <div><label htmlFor="ad">Adresse</label><input id="ad" value={f.address} onChange={on('address')} autoComplete="street-address" /><div className="err">{err.address}</div></div>
            </>}
            <div className="f"><label htmlFor="cp">Informations complémentaires</label><textarea id="cp" rows="2" placeholder="Repère, horaire souhaité…" value={f.notes} onChange={on('notes')} /></div>
            <div className="f"><label>Mode de livraison</label>
              <div className="rad">
                <label><input type="radio" name="mode" value="livraison" checked={f.mode === 'livraison'} onChange={on('mode')} /> Livraison à domicile</label>
                <label><input type="radio" name="mode" value="retrait" checked={f.mode === 'retrait'} onChange={on('mode')} /> Retrait en boutique</label>
              </div>
            </div>
          </div>
          <div className="acts"><button className="btn b1" type="submit" disabled={busy}>{busy ? 'Envoi en cours…' : 'Confirmer la commande'}</button><button className="btn b3" type="button" onClick={wa}>Envoyer sur WhatsApp</button></div>
        </form>
        <div className="sum">
          <h3 style={{ marginBottom: '1rem' }}>Votre commande</h3>
          {cart.items.map((i) => <div className="r" key={i.variantId}><span>{i.qty} × {i.name}<br /><small style={{ color: 'var(--mut)' }}>T.{i.size} · {i.color}</small></span><b>{fmt(i.price * i.qty)}</b></div>)}
          <div className="r" style={{ borderTop: '1px solid var(--line)', marginTop: 8 }}><span>Sous-total</span><b>{fmt(t.sub)}</b></div>
          <div className="r"><span>Livraison</span><b>{t.tbc ? 'À confirmer' : fmt(t.liv)}</b></div>
          <div className="r tt"><span>Total</span><span>{fmt(t.total)}</span></div>
        </div>
      </div>
    </>
  );
}
