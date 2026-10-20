import { Link } from 'react-router-dom';
import { fmt } from '../utils/format';
import { tileStyle } from '../utils/shop';
import Pic from './Pic';

/** Carte produit (format de la liste de l'API). */
export default function ProductCard({ p }) {
  return (
    <Link className="card" to={`/sandales/${p.slug}`}>
      <div className="bdg">
        {p.discount_percent > 0 && <b className="p">-{p.discount_percent}%</b>}
        {!p.in_stock ? <b className="r">Rupture de stock</b> : p.is_new && <b>Nouveau</b>}
      </div>
      <div className="im" style={tileStyle(p.id)}><Pic p={p} hex={p.colors[0]?.hex_code} /></div>
      <div className="bd">
        <span className="cat">{p.category.name}</span>
        <h3>{p.name}</h3>
        <div className="dots">{p.colors.map((c) => <i key={c.id} title={c.name} style={{ background: c.hex_code }} />)}</div>
        <div className="pr" style={{ marginTop: 'auto' }}>{fmt(p.price)}{p.old_price > p.price && <s>{fmt(p.old_price)}</s>}</div>
      </div>
    </Link>
  );
}
