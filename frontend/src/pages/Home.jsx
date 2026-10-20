import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBox, GridSkeleton } from '../components/Feedback';
import Icon from '../components/Icon';
import ProductCard from '../components/ProductCard';
import Reveal from '../components/Reveal';
import { logo } from '../components/Brand';
import { useShop } from '../context/ShopContext';
import useApi from '../hooks/useApi';
import usePageTitle from '../hooks/usePageTitle';
import { api } from '../services/api';
import { MARQUEE } from '../utils/constants';
import heroPhoto from '../assets/place.jpg';
import greyPhoto from '../assets/fondateur.jpg';

const ADV = [
  ['cuir', 'Cuir véritable', 'Matière noble et durable'],
  ['art', 'Fabrication artisanale', 'Cousue main, pièce par pièce'],
  ['gar', 'Qualité garantie', 'Nous réparons ce qui casse'],
  ['liv', 'Livraison disponible', 'Dakar, Pikine, Guédiawaye'],
  ['cmd', 'Commande facile', 'En ligne ou sur WhatsApp'],
];

export default function Home() {
  usePageTitle('');
  const { categories, zones } = useShop();
  const { data: featured, loading, error, reload } = useApi(() => api.featured(), []);
  const stage = useRef(null);
  const move = (e) => {
    const b = stage.current.getBoundingClientRect();
    stage.current.style.setProperty('--mx', ((e.clientX - b.left) / b.width - 0.5).toFixed(2));
    stage.current.style.setProperty('--my', ((e.clientY - b.top) / b.height - 0.5).toFixed(2));
  };
  const cheapest = featured?.length ? Math.min(...featured.map((p) => p.price)) : 12000;
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <span className="pill in-1">✦ Fait main à Dakar</span>
            <h1 className="in-2">Une caresse de cuir, <em>un voyage de confort.</em></h1>
            <p className="in-3">Sandales en cuir véritable, cousues à la main par nos artisans. Choisissez votre taille, votre couleur, commandez en ligne ou sur WhatsApp.</p>
            <div className="cta in-4">
              <Link className="btn b1" to="/catalogue">Découvrir nos sandales</Link>
              <Link className="btn b2" to="/panier">Commander</Link>
            </div>
          </div>
          <div className="stage in-3" ref={stage} onMouseMove={move}>
            <svg className="ring" viewBox="0 0 400 400" aria-hidden="true">
              <defs>
                <mask id="mk">
                  <circle cx="200" cy="200" r="186" fill="none" stroke="#fff" strokeWidth="10" pathLength="100" strokeDasharray="100" strokeDashoffset="100" transform="rotate(-90 200 200)">
                    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2.6s" begin=".4s" fill="freeze" />
                  </circle>
                </mask>
              </defs>
              <circle cx="200" cy="200" r="186" fill="none" stroke="#daa949" strokeWidth="3" strokeDasharray="9 9" strokeLinecap="round" mask="url(#mk)" />
              <circle cx="200" cy="200" r="160" fill="none" stroke="#daa94933" strokeWidth="1.5" />
            </svg>
            <div className="glow" />
            <img className="seal" src={logo} alt="Sira Yitte" width="150" height="150" />
            <div className="hs hp"><img src={heroPhoto} alt="place" /></div>
            <div className="tag">dès<br />{cheapest.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')} FCFA<small>cuir véritable</small></div>
          </div>
        </div>
      </section>

      <div className="mq" aria-hidden="true">
        <div>{Array(4).fill(0).map((_, k) => MARQUEE.map((t) => <span key={k + t}>{t} <s>✦</s></span>))}</div>
      </div>

      <section className="s"><div className="wrap">
        <Reveal className="sh">
          <div><h2>Les modèles que l’on vous demande</h2><p>Nos sandales les plus populaires, de la traditionnelle à la premium.</p></div>
          <Link className="btn b4 bs" to="/catalogue">Voir toute la collection</Link>
        </Reveal>
        <ErrorBox error={error} onRetry={reload} />
        {loading && !featured ? <GridSkeleton n={4} /> : (
          <div className="grid">{(featured || []).slice(0, 4).map((p, i) => <Reveal key={p.id} delay={i * 90}><ProductCard p={p} /></Reveal>)}</div>
        )}
        <Reveal className="chips" style={{ marginTop: 28 }}>
          {categories.map((c) => <Link key={c.id} className="chip" to={`/catalogue?category=${c.slug}`}>Sandale {c.name.toLowerCase()}</Link>)}
        </Reveal>
      </div></section>

      <section className="s alt"><div className="wrap two brand">
        <Reveal>
          <h2>Un savoir-faire transmis de main en main</h2>
          <p>Chez Sira Yitte, chaque paire naît dans notre atelier : le cuir est choisi, coupé, cousu puis poli à la main. Nous croyons aux chaussures qui se bonifient avec le temps et qui racontent une histoire, la vôtre.</p>
          <div className="facts">
            <div><b>100%</b><span>cuir véritable</span></div>
            <div><b>{zones.filter((z) => z.fee != null).length || 3}</b><span>zones de livraison</span></div>
            <div><b>10</b><span>tailles, du 36 au 45</span></div>
          </div>
        </Reveal>
        <Reveal className="stack">
          <div className="pc a"><img src={greyPhoto} alt="le fondateur" /></div>
          <div className="pc b"><img src={heroPhoto} alt="place" /></div>
        </Reveal>
      </div></section>

      <section className="s"><div className="wrap">
        <Reveal className="sh"><h2>Pourquoi nous choisir</h2></Reveal>
        <div className="adv">
          {ADV.map((a, i) => <Reveal key={a[0]} delay={i * 80}><Icon name={a[0]} /><b>{a[1]}</b><small>{a[2]}</small></Reveal>)}
        </div>
      </div></section>

      <section className="s" style={{ paddingTop: 0 }}><div className="wrap">
        <Reveal className="band">
          <img className="lg" src={logo} alt="Sira Yitte" width="104" height="104" />
          <h2>Trouvez la paire qui vous ressemble</h2>
          <Link className="btn b1" to="/catalogue">Voir toute la collection</Link>
        </Reveal>
      </div></section>
    </>
  );
}
