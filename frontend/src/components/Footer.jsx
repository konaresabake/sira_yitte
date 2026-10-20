import { Link } from 'react-router-dom';
import Brand from './Brand';
import { useShop } from '../context/ShopContext';
import { openWhatsApp } from '../utils/whatsapp';

export default function Footer() {
  const { shop } = useShop();
  return (
    <>
      <footer>
        <div className="wrap">
          <div>
            <div className="logo" style={{ color: '#f8efe2', marginBottom: '.8rem' }}><Brand /></div>
            <p style={{ maxWidth: '34ch' }}>Une caresse de cuir, un voyage de confort. Sandales artisanales en cuir véritable, fabriquées à la main.</p>
          </div>
          <div><h4>Boutique</h4><Link to="/catalogue">Catalogue</Link><Link to="/panier">Panier</Link><Link to="/suivi">Suivre ma commande</Link><Link to="/contact">Contact</Link></div>
          <div>
            <h4>Espace vendeur</h4><Link to="/admin">Administration</Link>
            <a href="#whatsapp" onClick={(e) => { e.preventDefault(); openWhatsApp(shop.whatsapp_number, 'Bonjour, je souhaite des informations sur vos sandales.'); }}>WhatsApp</a>
          </div>
          <div className="copy">© 2026 Sira Yitte.</div>
        </div>
      </footer>
      <a className="wa" href={`https://wa.me/${shop.whatsapp_number}`} target="_blank" rel="noopener noreferrer" aria-label="Discuter sur WhatsApp">
        <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.8.9c.3.1.5.2.6.3.1.2.1.8-.1 1.4z" /></svg>
      </a>
    </>
  );
}
