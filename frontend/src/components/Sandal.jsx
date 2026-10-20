import { COLORS } from '../utils/constants';
import { shade } from '../utils/format';

/** Sandale en SVG (illustration provisoire). model : 1 croisées, 2 entre-doigt, 3 large clouté. view : 0 normal, 1 zoom, 2 miroir. */
export default function Sandal({ color, model = 1, view = 0 }) {
  const col = COLORS[color] || color, dark = shade(col, -38), foot = shade(col, 14), light = shade(col, 55);
  const sk = { stroke: light, strokeWidth: 2, strokeDasharray: '5 6', fill: 'none', strokeLinecap: 'round', opacity: 0.7 };
  const cap = { fill: 'none', strokeLinecap: 'round' };
  let straps;
  if (model === 1) straps = (<>
    <path d="M86 120Q132 26 208 108" stroke={col} strokeWidth="22" {...cap} />
    <path d="M118 118Q192 40 242 108" stroke={shade(col, -12)} strokeWidth="20" {...cap} />
    <path d="M86 120Q132 26 208 108" {...sk} /><circle cx="168" cy="62" r="8" fill="#daa949" /></>);
  else if (model === 2) straps = (<>
    <path d="M92 120Q124 58 206 82" stroke={col} strokeWidth="18" {...cap} />
    <path d="M150 122Q176 76 206 82" stroke={shade(col, -12)} strokeWidth="18" {...cap} />
    <path d="M206 82L232 106" stroke={col} strokeWidth="14" {...cap} />
    <circle cx="206" cy="82" r="9" fill="#daa949" /><path d="M92 120Q124 58 206 82" {...sk} /></>);
  else straps = (<>
    <path d="M84 120Q140 18 238 106L238 122L84 126Z" fill={col} />
    <path d="M96 112Q146 36 226 104" {...sk} />
    {[[128, 76], [158, 60], [190, 68], [216, 92]].map((p) => <circle key={p[0]} cx={p[0]} cy={p[1]} r="5" fill="#daa949" />)}</>);
  return (
    <svg viewBox={view === 1 ? '60 20 190 125' : '0 0 300 170'} style={view === 2 ? { transform: 'scaleX(-1) rotate(4deg)' } : undefined} role="img" aria-label={`Sandale en cuir ${color}`}>
      <ellipse cx="152" cy="156" rx="125" ry="9" fill="#000" opacity=".16" />
      <path d="M16 132Q14 112 42 110L252 98Q290 96 290 122Q290 146 252 148L46 152Q16 152 16 132Z" fill={dark} />
      <path d="M28 126Q28 117 48 116L250 105Q276 104 278 120Q278 134 250 135L50 139Q28 139 28 126Z" fill={foot} />
      <path d="M40 123L250 112" stroke={light} strokeWidth="2" strokeDasharray="4 6" opacity=".5" />
      {straps}
    </svg>
  );
}
