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

describe('useIconFontReady', () => {
  let loadingdoneListeners: Array<() => void>;
  let readyResolve: () => void;
  let originalFonts: FontFaceSet | undefined;
  let mockFontLoaded: jest.SpyInstance;

  beforeEach(() => {
    originalFonts = document.fonts;

    loadingdoneListeners = [];

    Object.defineProperty(document, 'fonts', {
      value: {
        ready: new Promise<void>(resolve => {
          readyResolve = resolve;
        }),
        addEventListener: jest.fn((_event: string, cb: () => void) => {
          loadingdoneListeners.push(cb);
        }),
        removeEventListener: jest.fn((_event: string, cb: () => void) => {
          loadingdoneListeners = loadingdoneListeners.filter(l => l !== cb);
        })
      },
      writable: true,
      configurable: true
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../useIconFontReady');
    mockFontLoaded = jest.spyOn(mod, 'isFontLoaded').mockReturnValue(false);

    _resetForTesting();
  });

  afterEach(() => {
    mockFontLoaded.mockRestore();
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

    mockFontLoaded.mockReturnValue(true);
    act(() => {
      loadingdoneListeners.forEach(cb => cb());
    });

    expect(value).toBe(true);
  });

  it('transitions to true when document.fonts.ready resolves', async () => {
    let value = false;
    render(<HookConsumer onValue={v => (value = v)} />);
    expect(value).toBe(false);

    mockFontLoaded.mockReturnValue(true);
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
