import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ErrorBox } from '../components/Feedback';
import { useShop } from '../context/ShopContext';

export default function SiteLayout() {
  const { pathname } = useLocation();
  const { error, refresh, slow } = useShop();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <Header />
      {slow && <div className="wrap" style={{ paddingTop: 16 }}><div className="infobox" role="status">Le serveur démarre, cela peut prendre jusqu'à une minute. Merci de patienter…</div></div>}
      {error && <div className="wrap" style={{ paddingTop: 16 }}><ErrorBox error={error} onRetry={refresh} /></div>}
      <main className="view enter" key={pathname}><Outlet /></main>
      <Footer />
    </>
  );
}
