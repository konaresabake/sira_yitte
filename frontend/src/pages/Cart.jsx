import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Pic from '../components/Pic';
import { useCart } from '../context/CartContext';
import { useShop } from '../context/ShopContext';
import usePageTitle from '../hooks/usePageTitle';
import { fmt } from '../utils/format';
import { tileStyle } from '../utils/shop';

export const cartMessage = (items, total, extra) =>
  `Bonjour, je souhaite commander :\n${items.map((i) => `- ${i.name}\n  Taille : ${i.size}\n  Couleur : ${i.color}\n  Quantité : ${i.qty}\n  Prix : ${fmt(i.price * i.qty)}`).join('\n')}\n\nTotal : ${fmt(total)}\n\n${extra}`;

export default function Cart() {
  usePageTitle('Panier');
  const cart = useCart();
  const { zones, shop } = useShop();
  const nav = useNavigate();
  useEffect(() => { cart.sync(); }, []); // eslint-disable-line react-hooks/exhaustive-deps — vérifie stock et prix à l'ouverture
  const t = cart.totals();
  if (!cart.items.length) return (
    <div className="wrap empty" style={{ padding: '90px 0' }}>
      <h2>Votre panier est vide</h2><p>Ajoutez une paire pour commencer.</p><Link className="btn b1" to="/catalogue">Découvrir nos sandales</Link>
    </div>
  );
  return (
    <>
      <div className="pagehead"><div className="wrap"><h1>Votre panier</h1></div></div>
      <div className="wrap cl">
        <div>
          {cart.items.map((i) => (
            <div className="ci" key={i.variantId}>
              <div className="t" style={tileStyle(i.productId)}><Pic p={{ id: i.productId, name: i.name }} hex={i.hex} src={i.image} /></div>
              <div>
                <h3>{i.name}</h3><small>Taille {i.size} · {i.color} · {fmt(i.price)}</small>
                <div style={{ marginTop: 8 }} className="qty">
                  <button onClick={() => cart.setQty(i.variantId, i.qty - 1)} aria-label="Moins">−</button><span>{i.qty}</span><button onClick={() => cart.setQty(i.variantId, i.qty + 1)} aria-label="Plus">+</button>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}><b>{fmt(i.price * i.qty)}</b><br /><button className="bad" onClick={() => cart.remove(i.variantId)} style={{ fontSize: '.88rem', textDecoration: 'underline' }}>Supprimer</button></div>
            </div>
          ))}
        </div>
        <div className="sum">
          <h3 style={{ marginBottom: '1rem' }}>Récapitulatif</h3>
          <label htmlFor="zn">Zone de livraison</label>
          <select id="zn" value={cart.zoneId ?? ''} onChange={(e) => cart.setZone(Number(e.target.value))}>{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
          <div className="r"><span>Sous-total</span><b>{fmt(t.sub)}</b></div>
          <div className="r"><span>Livraison</span><b>{t.tbc ? 'À confirmer' : fmt(t.liv)}</b></div>
          <div className="r tt"><span>Total</span><span>{fmt(t.total)}</span></div>
          <Link className="btn b1" style={{ width: '100%', marginTop: 16 }} to="/commande">Valider la commande</Link>
          <button className="btn b3" style={{ width: '100%', marginTop: 10 }} type="button" onClick={() => { try { window.localStorage.setItem('sira-wa', '1'); } catch {} nav('/commande'); }}>Commander via WhatsApp</button>
        </div>
      </div>
    </>
  );
}
