import { useEffect, useRef, useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import usePageTitle from '../hooks/usePageTitle';
import { fmt, phoneOk } from '../utils/format';
import { openWhatsApp } from '../utils/whatsapp';

export default function Contact() {
  usePageTitle('Contact');
  const { shop, zones } = useShop();
  const toast = useToast();
  const [f, setF] = useState({ nom: '', tel: '', msg: '' });
  const [err, setErr] = useState({});
  const [shake, setShake] = useState(false);
  const shakeTimer = useRef();
  useEffect(() => () => clearTimeout(shakeTimer.current), []);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!f.nom.trim()) er.nom = 'Indiquez votre nom';
    if (!phoneOk(f.tel)) er.tel = 'Numéro invalide';
    if (f.msg.trim().length < 5) er.msg = 'Écrivez votre message';
    setErr(er);
    if (Object.keys(er).length) {
      setShake(true);
      clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShake(false), 450);
      return;
    }
    openWhatsApp(shop.whatsapp_number, `Bonjour, c’est ${f.nom} (${f.tel}).\n${f.msg}`);
    toast('Ouverture de WhatsApp…');
  };
  const num = shop.whatsapp_number.replace(/(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  return (
    <>
      <div className="pagehead"><div className="wrap"><h1>Contactez-nous</h1><p>Une question sur une taille, un modèle, une livraison ? Nous répondons vite.</p></div></div>
      <div className="wrap cl">
        <form className={'box' + (shake ? ' shake' : '')} onSubmit={submit} noValidate>
          <div className="fg">
            <div><label htmlFor="cn">Votre nom</label><input id="cn" value={f.nom} onChange={on('nom')} /><div className="err">{err.nom}</div></div>
            <div><label htmlFor="ct">Téléphone</label><input id="ct" type="tel" value={f.tel} onChange={on('tel')} /><div className="err">{err.tel}</div></div>
            <div className="f"><label htmlFor="cm">Message</label><textarea id="cm" rows="5" value={f.msg} onChange={on('msg')} /><div className="err">{err.msg}</div></div>
          </div>
          <div className="acts"><button className="btn b3" type="submit">Envoyer via WhatsApp</button></div>
        </form>
        <div className="box">
          <h3 style={{ marginBottom: '1rem' }}>Nos informations</h3>
          <p><b>WhatsApp professionnel</b><br />+{num}</p>
          <p><b>Atelier</b><br />{shop.address}</p>
          <p><b>Horaires</b><br />{shop.opening_hours}</p>
          <p><b>Livraison</b><br />{zones.map((z) => <span key={z.id}>{z.name} : {z.fee == null ? 'À confirmer' : fmt(z.fee)}<br /></span>)}</p>
        </div>
      </div>
    </>
  );
}
