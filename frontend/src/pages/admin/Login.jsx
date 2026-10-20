import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand';
import { Loader } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import { errorMessage } from '../../services/api';

export default function Login() {
  usePageTitle('Administration');
  const { isAdmin, ready, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const shakeTimer = useRef();
  useEffect(() => () => clearTimeout(shakeTimer.current), []);
  if (!ready) return <Loader />;
  if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(email, pw); nav('/admin/dashboard'); } catch (er) {
      setErr(er.status === 401 ? 'Email ou mot de passe incorrect' : errorMessage(er));
      setShake(true);
      clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShake(false), 450);
    } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className={'box' + (shake ? ' shake' : '')} onSubmit={submit}>
        <Link className="logo" to="/" style={{ marginBottom: '1rem', color: 'var(--tx)' }}><Brand /></Link>
        <h2 style={{ marginBottom: '.4rem' }}>Espace administrateur</h2>
        <p style={{ color: 'var(--mut)', marginTop: 0 }}>Connexion sécurisée par jeton JWT.</p>
        <label htmlFor="em">Email</label><input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        <label htmlFor="pw" style={{ marginTop: 12 }}>Mot de passe</label><input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
        <div className="err" role="alert">{err}</div>
        <button className="btn b1" style={{ width: '100%', marginTop: 10 }} type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </div>
  );
}
