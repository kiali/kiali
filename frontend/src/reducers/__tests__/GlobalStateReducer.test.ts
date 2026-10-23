import { GlobalStateReducer, INITIAL_GLOBAL_STATE } from '../GlobalState';
import { GlobalActions } from '../../actions/GlobalActions';
import { ColorScheme, ContrastMode, Language, Theme } from 'types/Common';

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
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, colorScheme: ColorScheme.LIGHT },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      loadingCounter: 1,
      colorScheme: ColorScheme.LIGHT
    });
  });

  it('should turn Loading spinner off', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, loadingCounter: 1, colorScheme: ColorScheme.LIGHT },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      colorScheme: ColorScheme.LIGHT
    });
  });

  it('should increment counter', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, loadingCounter: 1, colorScheme: ColorScheme.LIGHT },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      loadingCounter: 2,
      colorScheme: ColorScheme.LIGHT
    });
  });

  it('should decrement counter', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, loadingCounter: 2, colorScheme: ColorScheme.LIGHT },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      loadingCounter: 1,
      colorScheme: ColorScheme.LIGHT
    });
  });

  it('should turn on page visibility status', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, isPageVisible: false, colorScheme: ColorScheme.LIGHT },
        GlobalActions.setPageVisibilityVisible()
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      colorScheme: ColorScheme.LIGHT
    });
  });

  it('should turn off page visibility status', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, colorScheme: ColorScheme.LIGHT },
        GlobalActions.setPageVisibilityHidden()
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      isPageVisible: false,
      colorScheme: ColorScheme.LIGHT
    });
  });

  it('should turn on kiosk status', () => {
    expect(
      GlobalStateReducer({ ...INITIAL_GLOBAL_STATE, colorScheme: ColorScheme.LIGHT }, GlobalActions.setKiosk('test'))
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      kiosk: 'test',
      colorScheme: ColorScheme.LIGHT
    });
  });

  it('should set kiosk data', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, colorScheme: ColorScheme.LIGHT },
        GlobalActions.setKioskData({ hasExternalTracing: false, hasNetobserv: false })
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      kioskData: { hasExternalTracing: false, hasNetobserv: false },
      colorScheme: ColorScheme.LIGHT
    });
  });

  it('should switch to english language', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, colorScheme: ColorScheme.LIGHT },
        GlobalActions.setLanguage(Language.ENGLISH)
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      language: Language.ENGLISH,
      colorScheme: ColorScheme.LIGHT
    });
  });

  it('should turn on dark theme', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, colorScheme: ColorScheme.LIGHT },
        GlobalActions.setColorScheme(ColorScheme.DARK)
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      colorScheme: ColorScheme.DARK
    });
  });

  it('should set contrast mode', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, contrastMode: ContrastMode.DEFAULT, colorScheme: ColorScheme.LIGHT },
        GlobalActions.setContrastMode(ContrastMode.GLASS)
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      contrastMode: ContrastMode.GLASS,
      colorScheme: ColorScheme.LIGHT
    });
  });

  it('should set theme variant', () => {
    expect(
      GlobalStateReducer(
        { ...INITIAL_GLOBAL_STATE, contrastMode: ContrastMode.DEFAULT, colorScheme: ColorScheme.LIGHT },
        GlobalActions.setTheme(Theme.FELT)
      )
    ).toEqual({
      ...INITIAL_GLOBAL_STATE,
      contrastMode: ContrastMode.DEFAULT,
      colorScheme: ColorScheme.LIGHT,
      theme: Theme.FELT
    });
  });
});
