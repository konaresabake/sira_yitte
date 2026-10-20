import { useEffect } from 'react';
export default function usePageTitle(title) {
  useEffect(() => { document.title = title ? `${title} | Sira Yitte` : 'Sira Yitte | Sandales artisanales en cuir'; }, [title]);
}
