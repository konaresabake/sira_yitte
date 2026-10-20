import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Brand from './Brand';
import { useCart } from '../context/CartContext';

export default function Header() {
  const { count: cartCount } = useCart();
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!cartCount) return undefined;
    setBump(true);
    const t = setTimeout(() => setBump(false), 500);
    return () => clearTimeout(t);
  }, [cartCount]);
  const cls = ({ isActive }) => (isActive ? 'on' : '');
  return (
    <header className="top">
      <div className="wrap nav">
        <Link className="logo" to="/"><Brand /></Link>
        <nav className={open ? 'open' : ''}>
          <NavLink end to="/" className={cls}>Accueil</NavLink>
          <NavLink to="/catalogue" className={cls}>Catalogue</NavLink>
          <NavLink to="/contact" className={cls}>Contact</NavLink>
        </nav>
        <Link className={'cartb' + (bump ? ' bump' : '')} to="/panier" aria-label={`Panier, ${cartCount} article${cartCount > 1 ? 's' : ''}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 8h14l-1.5 12h-11zM9 8a3 3 0 0 1 6 0" /></svg>
          {cartCount > 0 && <b>{cartCount}</b>}
        </Link>
        <button className="burger" onClick={() => setOpen(!open)} aria-label="Menu">
          <svg width="26" height="26" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
    </header>
  );
}
