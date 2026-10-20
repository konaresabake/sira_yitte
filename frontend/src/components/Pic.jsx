import { PHOTO_ZOOMS } from '../utils/constants';
import { modelOf } from '../utils/shop';
import Sandal from './Sandal';

/**
 * Visuel d'un produit : vraie photo (API) si elle existe, sinon illustration SVG.
 * `p` : { id, image?, name }, `hex` : couleur de l'illustration, `view` : 0 normal, 1 et 2 zooms.
 */
export default function Pic({ p, hex = '#7a4a2a', view = 0, src }) {
  const image = src ?? p.image;
  if (!image) return <Sandal color={hex} model={modelOf(p.id)} view={view} />;
  const z = view ? PHOTO_ZOOMS[(view - 1) % PHOTO_ZOOMS.length] : null;
  return <img className={'ph' + (z ? ' z' : '')} style={z ? { '--s': z[0], '--o': z[1] } : undefined} src={image} alt={p.name || ''} loading="lazy" />;
}
