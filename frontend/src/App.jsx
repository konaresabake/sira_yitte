import { Navigate, Route, Routes } from 'react-router-dom';
import SiteLayout from './layouts/SiteLayout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/Home';
import Catalogue from './pages/Catalogue';
import ProductPage from './pages/ProductPage';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import Contact from './pages/Contact';
import TrackOrder from './pages/TrackOrder';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Products from './pages/admin/Products';
import Categories from './pages/admin/Categories';
import Stocks from './pages/admin/Stocks';
import Orders from './pages/admin/Orders';
import Customers from './pages/admin/Customers';
import Delivery from './pages/admin/Delivery';

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="catalogue" element={<Catalogue />} />
        <Route path="sandales/:slug" element={<ProductPage />} />
        <Route path="panier" element={<Cart />} />
        <Route path="commande" element={<Checkout />} />
        <Route path="confirmation/:number" element={<Confirmation />} />
        <Route path="suivi" element={<TrackOrder />} />
        <Route path="contact" element={<Contact />} />
      </Route>
      <Route path="admin">
        <Route index element={<Login />} />
        <Route element={<AdminLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="produits" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="stocks" element={<Stocks />} />
          <Route path="commandes" element={<Orders />} />
          <Route path="clients" element={<Customers />} />
          <Route path="livraison" element={<Delivery />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
