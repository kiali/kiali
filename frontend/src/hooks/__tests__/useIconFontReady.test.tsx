import * as React from 'react';
import { render, act } from '@testing-library/react';
import { useIconFontReady, _resetForTesting } from '../useIconFontReady';

const HookConsumer: React.FC<{ onValue: (v: boolean) => void }> = ({ onValue }) => {
  const ready = useIconFontReady();
  React.useEffect(() => {
    onValue(ready);
  }, [ready, onValue]);
  return <div data-testid="hook-output" data-ready={String(ready)} />;
};

// isFontLoaded compares measureText widths between a monospace fallback and the
// PF icon font. We control its return value by making the mock canvas report
// different widths when the icon font family is set vs monospace-only.
const FALLBACK_WIDTH = 10;
const LOADED_WIDTH = 14;
let simulateFontLoaded = false;

const makeCanvasCtx = (): Record<string, unknown> => {
  let currentFont = '';
  return {
    get font() {
      return currentFont;
    },
    set font(v: string) {
      currentFont = v;
    },
    measureText: () => {
      const isIconFont = currentFont.includes('pf-v6-pficon');
      return { width: simulateFontLoaded && isIconFont ? LOADED_WIDTH : FALLBACK_WIDTH };
    }
  };
};

describe('useIconFontReady', () => {
  let loadingdoneListeners: Array<() => void>;
  let readyResolve: () => void;
  let originalFonts: FontFaceSet | undefined;
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    originalFonts = document.fonts;
    origGetContext = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = ((type: string) => {
      if (type === '2d') return makeCanvasCtx();
      return null;
    }) as any;

    simulateFontLoaded = false;
    loadingdoneListeners = [];

    Object.defineProperty(document, 'fonts', {
      value: {
        ready: new Promise<void>(resolve => {
          readyResolve = resolve;
        }),
        addEventListener: rstest.fn((_event: string, cb: () => void) => {
          loadingdoneListeners.push(cb);
        }),
        removeEventListener: rstest.fn((_event: string, cb: () => void) => {
          loadingdoneListeners = loadingdoneListeners.filter(l => l !== cb);
        })
      },
      writable: true,
      configurable: true
    });

    _resetForTesting();
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    Object.defineProperty(document, 'fonts', {
      value: originalFonts,
      writable: true,
      configurable: true
    });
  });

  it('starts as false when font is not loaded', () => {
    let value = false;
    render(<HookConsumer onValue={v => (value = v)} />);
    expect(value).toBe(false);
  });

  it('transitions to true when font loads via loadingdone event', () => {
    let value = false;
    render(<HookConsumer onValue={v => (value = v)} />);
    expect(value).toBe(false);

    simulateFontLoaded = true;
    act(() => {
      loadingdoneListeners.forEach(cb => cb());
    });

    expect(value).toBe(true);
  });

  it('transitions to true when document.fonts.ready resolves', async () => {
    let value = false;
    render(<HookConsumer onValue={v => (value = v)} />);
    expect(value).toBe(false);

    simulateFontLoaded = true;
    await act(async () => {
      readyResolve();
    });

    expect(value).toBe(true);
  });

  it('removes event listener on unmount', () => {
    const { unmount } = render(<HookConsumer onValue={() => {}} />);
    unmount();

    expect(document.fonts!.removeEventListener).toHaveBeenCalledWith('loadingdone', expect.any(Function));
  });

  it('returns true when document.fonts is undefined', () => {
    Object.defineProperty(document, 'fonts', {
      value: undefined,
      writable: true,
      configurable: true
    });
    _resetForTesting();

    let value = false;
    act(() => {
      render(<HookConsumer onValue={v => (value = v)} />);
    });

    expect(value).toBe(true);
  });
});
