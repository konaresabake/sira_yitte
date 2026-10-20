import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Set());
  useEffect(() => () => timers.current.forEach(clearTimeout), []); // démontage : plus de setState orphelin
  const toast = useCallback((text) => {
    const id = Math.random();
    setItems((l) => [...l, { id, text }]);
    const t = setTimeout(() => { timers.current.delete(t); setItems((l) => l.filter((i) => i.id !== id)); }, 3100);
    timers.current.add(t);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div id="toast" aria-live="polite">{items.map((i) => <div key={i.id}>{i.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}
