import { GlobalStateReducer } from '../GlobalState';
import { GlobalActions } from '../../actions/GlobalActions';
import { ContrastMode, Language, Theme } from 'types/Common';
import type { GlobalState } from 'store/Store';

describe('GlobalStateReducer reducer', () => {
  const RealDate = Date.now;
  const currentDate = Date.now();

  const baseState = (overrides: Partial<GlobalState> = {}): GlobalState => ({
    contrastMode: ContrastMode.DEFAULT,
    isPageVisible: true,
    kiosk: '',
    kioskData: undefined,
    language: '',
    loadingCounter: 0,
    theme: Theme.LIGHT,
    ...overrides
  });

  const mockDate = (date: number): number => {
    global.Date.now = rstest.fn(() => date);

    return date;
  };

  beforeEach(() => {
    mockDate(currentDate);
  });

  afterEach(() => {
    global.Date.now = RealDate;
  });

  it('should return the initial state', () => {
    expect(GlobalStateReducer(undefined, GlobalActions.unknown())).toEqual({
      contrastMode: '',
      isPageVisible: true,
      kiosk: '',
      kioskData: undefined,
      language: '',
      loadingCounter: 0,
      theme: ''
    });
  });

  it('should turn Loading spinner On', () => {
    expect(GlobalStateReducer(baseState(), GlobalActions.incrementLoadingCounter())).toEqual(
      baseState({ loadingCounter: 1 })
    );
  });

  it('should turn Loading spinner off', () => {
    expect(GlobalStateReducer(baseState({ loadingCounter: 1 }), GlobalActions.decrementLoadingCounter())).toEqual(
      baseState()
    );
  });

  it('should increment counter', () => {
    expect(GlobalStateReducer(baseState({ loadingCounter: 1 }), GlobalActions.incrementLoadingCounter())).toEqual(
      baseState({ loadingCounter: 2 })
    );
  });

  it('should decrement counter', () => {
    expect(GlobalStateReducer(baseState({ loadingCounter: 2 }), GlobalActions.decrementLoadingCounter())).toEqual(
      baseState({ loadingCounter: 1 })
    );
  });

  it('should turn on page visibility status', () => {
    expect(GlobalStateReducer(baseState({ isPageVisible: false }), GlobalActions.setPageVisibilityVisible())).toEqual(
      baseState()
    );
  });

  it('should turn off page visibility status', () => {
    expect(GlobalStateReducer(baseState(), GlobalActions.setPageVisibilityHidden())).toEqual(
      baseState({ isPageVisible: false })
    );
  });

  it('should turn on kiosk status', () => {
    expect(GlobalStateReducer(baseState(), GlobalActions.setKiosk('test'))).toEqual(baseState({ kiosk: 'test' }));
  });

  it('should set kiosk data', () => {
    expect(
      GlobalStateReducer(baseState(), GlobalActions.setKioskData({ hasExternalTracing: false, hasNetobserv: false }))
    ).toEqual(baseState({ kioskData: { hasExternalTracing: false, hasNetobserv: false } }));
  });

  it('should switch to english language', () => {
    expect(GlobalStateReducer(baseState(), GlobalActions.setLanguage(Language.ENGLISH))).toEqual(
      baseState({ language: Language.ENGLISH })
    );
  });

  it('should turn on dark theme', () => {
    expect(GlobalStateReducer(baseState(), GlobalActions.setTheme(Theme.DARK))).toEqual(
      baseState({ theme: Theme.DARK })
    );
  });

  it('should set glass contrast mode', () => {
    expect(GlobalStateReducer(baseState(), GlobalActions.setContrastMode(ContrastMode.GLASS))).toEqual(
      baseState({ contrastMode: ContrastMode.GLASS })
    );
  });

  it('should set high contrast mode', () => {
    expect(GlobalStateReducer(baseState(), GlobalActions.setContrastMode(ContrastMode.HIGH_CONTRAST))).toEqual(
      baseState({ contrastMode: ContrastMode.HIGH_CONTRAST })
    );
  });
});
