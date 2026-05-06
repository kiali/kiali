import { useEffect, useState } from 'react';

const PF_ICON_FONT = 'pf-v6-pficon';
const TEST_CHAR = '\uE923';

export const isFontLoaded = (): boolean => {
  if (typeof document === 'undefined') return true;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return true;
  ctx.font = '16px monospace';
  const fallback = ctx.measureText(TEST_CHAR).width;
  ctx.font = `16px ${PF_ICON_FONT}, monospace`;
  return ctx.measureText(TEST_CHAR).width !== fallback;
};

let globalReady = isFontLoaded();

export const _resetForTesting = (): void => {
  globalReady = false;
};

export const useIconFontReady = (): boolean => {
  const [ready, setReady] = useState(globalReady);

  useEffect(() => {
    if (globalReady) {
      setReady(true);
      return;
    }
    if (!document.fonts) {
      globalReady = true;
      setReady(true);
      return;
    }

    let active = true;

    const markReady = (): void => {
      if (!active || globalReady) return;
      globalReady = true;
      setReady(true);
      document.fonts.removeEventListener('loadingdone', check);
    };

    const check = (): void => {
      if (!active || globalReady) return;
      if (isFontLoaded()) {
        markReady();
      }
    };

    document.fonts.ready.then(check);
    document.fonts.addEventListener('loadingdone', check);

    return () => {
      active = false;
      document.fonts.removeEventListener('loadingdone', check);
    };
  }, []);

  return ready;
};
