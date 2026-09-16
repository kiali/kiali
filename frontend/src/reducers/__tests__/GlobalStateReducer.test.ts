import { GlobalStateReducer, INITIAL_GLOBAL_STATE } from '../GlobalState';
import { GlobalActions } from '../../actions/GlobalActions';
import { ContrastMode, Language, Theme, ThemeVariant } from 'types/Common';

describe('GlobalStateReducer reducer', () => {
  const RealDate = Date.now;
  const currentDate = Date.now();

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
    expect(GlobalStateReducer(undefined, GlobalActions.unknown())).toEqual(INITIAL_GLOBAL_STATE);
  });

  it('should turn Loading spinner On', () => {
    expect(
      GlobalStateReducer({ ...INITIAL_GLOBAL_STATE, colorScheme: Theme.LIGHT }, GlobalActions.incrementLoadingCounter())
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      loadingCounter: 1,
      colorScheme: Theme.LIGHT
    });
  });

  it('should turn Loading spinner off', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, loadingCounter: 1, colorScheme: Theme.LIGHT },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      colorScheme: Theme.LIGHT
    });
  });

  it('should increment counter', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, loadingCounter: 1, colorScheme: Theme.LIGHT },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      loadingCounter: 2,
      colorScheme: Theme.LIGHT
    });
  });

  it('should decrement counter', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, loadingCounter: 2, colorScheme: Theme.LIGHT },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      loadingCounter: 1,
      colorScheme: Theme.LIGHT
    });
  });

  it('should turn on page visibility status', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, isPageVisible: false, colorScheme: Theme.LIGHT },
        GlobalActions.setPageVisibilityVisible()
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      colorScheme: Theme.LIGHT
    });
  });

  it('should turn off page visibility status', () => {
    expect(
      GlobalStateReducer({ ...INITIAL_GLOBAL_STATE, colorScheme: Theme.LIGHT }, GlobalActions.setPageVisibilityHidden())
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      isPageVisible: false,
      colorScheme: Theme.LIGHT
    });
  });

  it('should turn on kiosk status', () => {
    expect(
      GlobalStateReducer({ ...INITIAL_GLOBAL_STATE, colorScheme: Theme.LIGHT }, GlobalActions.setKiosk('test'))
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      kiosk: 'test',
      colorScheme: Theme.LIGHT
    });
  });

  it('should set kiosk data', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, colorScheme: Theme.LIGHT },
        GlobalActions.setKioskData({ hasExternalTracing: false, hasNetobserv: false })
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      kioskData: { hasExternalTracing: false, hasNetobserv: false },
      colorScheme: Theme.LIGHT
    });
  });

  it('should switch to english language', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, colorScheme: Theme.LIGHT },
        GlobalActions.setLanguage(Language.ENGLISH)
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      language: Language.ENGLISH,
      colorScheme: Theme.LIGHT
    });
  });

  it('should turn on dark theme', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, colorScheme: Theme.LIGHT },
        GlobalActions.setColorScheme(Theme.DARK)
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      colorScheme: Theme.DARK
    });
  });

  it('should set contrast mode', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, contrastMode: ContrastMode.TRADITIONAL, colorScheme: Theme.LIGHT },
        GlobalActions.setContrastMode(ContrastMode.GLASS)
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      contrastMode: ContrastMode.GLASS,
      colorScheme: Theme.LIGHT
    });
  });

  it('should set theme variant', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, contrastMode: ContrastMode.TRADITIONAL, colorScheme: Theme.LIGHT },
        GlobalActions.setTheme(ThemeVariant.FELT)
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      contrastMode: ContrastMode.TRADITIONAL,
      colorScheme: Theme.LIGHT,
      theme: ThemeVariant.FELT
    });
  });
});
