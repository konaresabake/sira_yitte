import { useEffect, useRef, useState } from 'react';

/** Révèle son contenu (fondu + montée) à l'entrée dans l'écran. */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`rv ${on ? 'in' : ''} ${className}`} style={{ transitionDelay: delay + 'ms' }} {...rest}>{children}</Tag>;
}
