import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBox, Loader } from '../components/Feedback';
import Pic from '../components/Pic';
import { useCart } from '../context/CartContext';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import usePageTitle from '../hooks/usePageTitle';
import { api } from '../services/api';
import { fmt } from '../utils/format';
import { tileStyle } from '../utils/shop';
import { openWhatsApp } from '../utils/whatsapp';

export default function ProductPage() {
  const { slug } = useParams();
  const { data: p, loading, error, reload } = useApi(() => api.product(slug), [slug]);
  usePageTitle(p ? p.name : 'Sandale');
  if (error?.status === 404) return <div className="wrap empty"><h2>Sandale introuvable</h2><Link className="btn b1" to="/catalogue" style={{ marginTop: 14 }}>Retour au catalogue</Link></div>;
  if (error && !p) return <div className="wrap" style={{ padding: '40px 20px' }}><ErrorBox error={error} onRetry={reload} /></div>;
  if (!p || p.slug !== slug) return <Loader label="Chargement de la sandale…" />;
  return <ProductDetail key={p.id} p={p} />;
}

function ProductDetail({ p }) {
  const cart = useCart();
  const { shop } = useShop();
  const toast = useToast();
  const colors = useMemo(() => {
    const m = new Map();
    p.variants.forEach((v) => m.set(v.color, { id: v.color, name: v.color_name, hex: v.hex_code, stock: (m.get(v.color)?.stock || 0) + v.stock }));
    return [...m.values()];
  }, [p]);
  const [colorId, setColorId] = useState(() => (colors.find((c) => c.stock > 0) || colors[0])?.id);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const color = colors.find((c) => c.id === colorId);
  const sizes = p.variants.filter((v) => v.color === colorId).sort((a, b) => a.size - b.size);
  const variant = sizes.find((v) => v.id === variantId) || null;
  const promo = p.old_price > p.price;

  const views = useMemo(() => {
    if (!p.images.length) return [0, 1, 2].map((v) => ({ view: v }));
    const out = p.images.slice(0, 3).map((i) => ({ src: i.image }));
    for (let k = 1; out.length < 3; k++) out.push({ src: p.images[0].image, view: k });
    return out;
  }, [p]);
  const stockMsg = !variant ? <span className="stk">Choisissez une taille pour voir la disponibilité</span>
    : variant.stock === 0 ? <span className="stk out">Rupture de stock</span>
    : variant.stock <= 3 ? <span className="stk lo">Plus que {variant.stock} disponible{variant.stock > 1 ? 's' : ''}</span>
    : <span className="stk ok">En stock ({variant.stock} disponibles)</span>;

  const needSize = () => { if (!variant) { toast('Choisissez une taille'); return true; } return false; };
  const add = () => { if (!needSize()) cart.add(p, variant, qty); };
  const wa = () => {
    if (needSize()) return;
    openWhatsApp(shop.whatsapp_number, `Bonjour, je souhaite commander :\n- ${p.name}\n- Taille : ${variant.size}\n- Couleur : ${variant.color_name}\n- Quantité : ${qty}\n\nPrix : ${fmt(p.price * qty)}\n\nNom : ...\nTéléphone : ...\nAdresse : ...`);
  };

  return (
    <div className="wrap">
      <div className="crumb"><Link to="/">Accueil</Link> / <Link to="/catalogue">Sandales</Link> / {p.name}</div>
      <div className="pd">
        <div className="gal">
          <div className={'big' + (p.images.length ? ' pho' : '')} style={tileStyle(p.id)}>
            <Pic key={color?.id + '-' + img} p={p} hex={color?.hex} src={views[img].src} view={views[img].view || 0} />
          </div>
          <div className="thumbs">
            {views.map((v, i) => <button key={i} className={img === i ? 'on' : ''} style={tileStyle(p.id)} onClick={() => setImg(i)} aria-label={`Photo ${i + 1}`}><Pic p={p} hex={color?.hex} src={v.src} view={v.view || 0} /></button>)}
          </div>
        </div>
        <div>
          <span className="cat">{p.category.name}</span>
          <h1>{p.name}</h1>
          <div className="pr">{fmt(p.price)}{promo && <s>{fmt(p.old_price)}</s>}</div>
          <p style={{ color: 'var(--mut)' }}>{p.description}</p>
          <div className="opt"><h4>Couleur : {color?.name}</h4>
            <div className="chips">{colors.map((c) => <button key={c.id} className={'sw' + (colorId === c.id ? ' on' : '')} style={{ background: c.hex }} title={c.name} aria-label={c.name} onClick={() => { setColorId(c.id); setVariantId(null); setQty(1); }} />)}</div>
          </div>
          <div className="opt"><h4>Taille</h4>
            <div className="sizes">{sizes.map((v) => <button key={v.id} className={'sz' + (variantId === v.id ? ' on' : '')} disabled={v.stock === 0} onClick={() => { setVariantId(v.id); setQty(1); }}>{v.size}</button>)}</div>
            <p style={{ margin: '.6rem 0 0' }}>{stockMsg}</p>
          </div>
          <div className="opt"><h4>Quantité</h4>
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Moins">−</button><span>{qty}</span>
              <button onClick={() => setQty(Math.min(variant ? Math.max(1, variant.stock) : 9, qty + 1))} aria-label="Plus">+</button>
            </div>
          </div>
          <div className="acts"><button className="btn b1" onClick={add}>Ajouter au panier</button><button className="btn b3" onClick={wa}>Commander via WhatsApp</button></div>
          <div className="info">
            <details open><summary>Matière et fabrication</summary><p>{p.material}. Fabriquée à la main dans notre atelier.</p></details>
            <details><summary>Entretien</summary><p>Nettoyez avec un chiffon sec et nourrissez le cuir avec une crème neutre tous les deux mois.</p></details>
            <details><summary>Livraison</summary><p>Frais selon votre zone, calculés dans le panier. {shop.opening_hours}.</p></details>
          </div>
        </div>
      </div>
    </div>
  );
}
