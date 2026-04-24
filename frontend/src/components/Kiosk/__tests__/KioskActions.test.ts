import { store } from '../../../store/ConfigStore';
import { GlobalActions } from '../../../actions/GlobalActions';
import { isKiosk, isParentKiosk, kioskNavigateAction } from '../KioskActions';

describe('isKiosk', () => {
  const cases: [string, boolean][] = [
    ['', false],
    ['true', true],
    ['https://console.example.com', true]
  ];

  it.each(cases)('isKiosk(%j) === %s', (input, expected) => {
    expect(isKiosk(input)).toBe(expected);
  });
});

describe('isParentKiosk', () => {
  const cases: [string, boolean][] = [
    ['', false],
    ['true', false],
    ['https://console.example.com', true],
    ['/', true],
    ['*', true]
  ];

  it.each(cases)('isParentKiosk(%j) === %s', (input, expected) => {
    expect(isParentKiosk(input)).toBe(expected);
  });
});

describe('sendParentMessage (via kioskNavigateAction)', () => {
  let postMessageSpy: jest.SpyInstance;

  beforeEach(() => {
    postMessageSpy = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    store.dispatch(GlobalActions.setKiosk(''));
    postMessageSpy.mockRestore();
  });

  it('does not post when kiosk is empty', () => {
    store.dispatch(GlobalActions.setKiosk(''));

    kioskNavigateAction('/details');

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('does not post when kiosk is "true" (standalone kiosk, no parent)', () => {
    store.dispatch(GlobalActions.setKiosk('true'));

    kioskNavigateAction('/details');

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('does not post when kiosk is "*" (wildcard targetOrigin bypass)', () => {
    store.dispatch(GlobalActions.setKiosk('*'));

    kioskNavigateAction('/details');

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('posts to window when not embedded in an iframe (OSSMC same-window)', () => {
    const origin = 'https://console.example.com';
    store.dispatch(GlobalActions.setKiosk(origin));

    kioskNavigateAction('/details');

    expect(postMessageSpy).toHaveBeenCalledWith('/details', origin);
  });

  it('posts to window.top when embedded in an iframe', () => {
    const origin = 'https://console.example.com';
    store.dispatch(GlobalActions.setKiosk(origin));

    const mockTop = ({ postMessage: jest.fn() } as unknown) as Window;
    const originalTop = Object.getOwnPropertyDescriptor(window, 'top');

    Object.defineProperty(window, 'top', { value: mockTop, configurable: true });
    try {
      kioskNavigateAction('/details');

      expect(mockTop.postMessage).toHaveBeenCalledWith('/details', origin);
      expect(postMessageSpy).not.toHaveBeenCalled();
    } finally {
      if (originalTop) {
        Object.defineProperty(window, 'top', originalTop);
      }
    }
  });
});
