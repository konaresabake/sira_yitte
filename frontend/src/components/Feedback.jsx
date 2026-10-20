import { errorMessage } from '../services/api';

export function Loader({ label = 'Chargement…' }) {
  return <div className="loading" role="status"><div className="spinner" />{label}</div>;
}

export function GridSkeleton({ n = 6 }) {
  return <div className="grid" aria-busy="true">{Array.from({ length: n }, (_, i) => <div className="skel" key={i} />)}</div>;
}

/** Erreur API avec bouton Réessayer. */
export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="errbox" role="alert">
      <b>{errorMessage(error)}</b>
      {onRetry && <div><button className="btn b4 bs" onClick={onRetry}>Réessayer</button></div>}
    </div>
  );
}

/** Liste de messages d'erreur de validation (ex. stock insuffisant). */
export function ErrorList({ messages }) {
  if (!messages?.length) return null;
  return <div className="errbox" role="alert"><ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul></div>;
}
