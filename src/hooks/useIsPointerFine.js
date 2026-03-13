import { useState, useEffect } from 'react';

const mq = typeof window !== 'undefined' ? window.matchMedia('(pointer: fine)') : null;

export function useIsPointerFine() {
  const [fine, setFine] = useState(mq?.matches ?? false);
  useEffect(() => {
    if (!mq) return;
    const handler = (e) => setFine(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return fine;
}
