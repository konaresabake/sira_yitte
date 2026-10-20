import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import Brand from '../components/Brand';
import { Loader } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import useApi from '../hooks/useApi';
import { api } from '../services/api';

const TABS = [['dashboard', 'Tableau de bord'], ['produits', 'Produits'], ['categories', 'Catégories'], ['stocks', 'Stocks'], ['commandes', 'Commandes'], ['clients', 'Clients'], ['livraison', 'Livraison']];

/** Protège /admin/* : sans session administrateur valide, retour à la page de connexion. */
export default function AdminLayout() {
  const { isAdmin, ready, logout } = useAuth();
  const { pathname } = useLocation();
  const { data: fresh } = useApi(() => (isAdmin ? api.admin.orders({ status: 'nouvelle', page_size: 1 }) : Promise.resolve(null)), [isAdmin, pathname]);
  if (!ready) return <Loader label="Vérification de la session…" />;
  if (!isAdmin) return <Navigate to="/admin" replace />;
  const news = fresh?.count || 0;
  return (
    <div className="adm">
      <aside className="sb">
        <Link className="logo" to="/"><Brand /></Link>
        {TABS.map(([k, label]) => (
          <NavLink key={k} to={`/admin/${k}`} className={({ isActive }) => (isActive ? 'on' : '')}>
            {label}{k === 'commandes' && news > 0 && <span className="nb">{news}</span>}
          </NavLink>
        ))}
        <Link to="/" style={{ marginTop: 'auto' }}>← Voir le site</Link>
        <a href="#logout" onClick={(e) => { e.preventDefault(); logout(); }}>Déconnexion</a>
      </aside>
      <main className="am view enter" key={pathname}><Outlet /></main>
    </div>
  );
}
