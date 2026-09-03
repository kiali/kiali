import { GlobalStateReducer } from '../GlobalState';
import { GlobalActions } from '../../actions/GlobalActions';
import { ContrastMode, Language, Theme } from 'types/Common';

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
    expect(
      GlobalStateReducer(
        {
          contrastMode: '',
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      contrastMode: '',
      loadingCounter: 1,
      isPageVisible: true,
      kiosk: '',
      kioskData: undefined,
      language: '',
      theme: Theme.LIGHT
    });
  });

  it('should turn Loading spinner off', () => {
    expect(
      GlobalStateReducer(
        {
          contrastMode: '',
          loadingCounter: 1,
          isPageVisible: true,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      contrastMode: '',
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      kioskData: undefined,
      language: '',
      theme: Theme.LIGHT
    });
  });

  it('should increment counter', () => {
    expect(
      GlobalStateReducer(
        {
          contrastMode: '',
          loadingCounter: 1,
          isPageVisible: true,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      contrastMode: '',
      loadingCounter: 2,
      isPageVisible: true,
      kiosk: '',
      kioskData: undefined,
      language: '',
      theme: Theme.LIGHT
    });
  });

  it('should decrement counter', () => {
    expect(
      GlobalStateReducer(
        {
          contrastMode: '',
          loadingCounter: 2,
          isPageVisible: true,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      contrastMode: '',
      loadingCounter: 1,
      isPageVisible: true,
      kiosk: '',
      kioskData: undefined,
      language: '',
      theme: Theme.LIGHT
    });
  });

  it('should turn on page visibility status', () => {
    expect(
      GlobalStateReducer(
        {
          contrastMode: '',
          loadingCounter: 0,
          isPageVisible: false,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setPageVisibilityVisible()
      )
    ).toEqual({
      contrastMode: '',
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      kioskData: undefined,
      language: '',
      theme: Theme.LIGHT
    });
  });

  it('should turn off page visibility status', () => {
    expect(
      GlobalStateReducer(
        {
          contrastMode: '',
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setPageVisibilityHidden()
      )
    ).toEqual({
      contrastMode: '',
      loadingCounter: 0,
      isPageVisible: false,
      kiosk: '',
      kioskData: undefined,
      language: '',
      theme: Theme.LIGHT
    });
  });

  it('should turn on kiosk status', () => {
    expect(
      GlobalStateReducer(
        {
          contrastMode: '',
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setKiosk('test')
      )
    ).toEqual({
      contrastMode: '',
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: 'test',
      kioskData: undefined,
      language: '',
      theme: Theme.LIGHT
    });
  });

  it('should set kiosk data', () => {
    expect(
      GlobalStateReducer(
        {
          contrastMode: '',
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setKioskData({ hasExternalTracing: false, hasNetobserv: false })
      )
    ).toEqual({
      contrastMode: '',
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      kioskData: { hasExternalTracing: false, hasNetobserv: false },
      language: '',
      theme: Theme.LIGHT
    });
  });

  it('should switch to english language', () => {
    expect(
      GlobalStateReducer(
        {
          contrastMode: '',
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setLanguage(Language.ENGLISH)
      )
    ).toEqual({
      contrastMode: '',
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      kioskData: undefined,
      language: Language.ENGLISH,
      theme: Theme.LIGHT
    });
  });

  it('should turn on dark theme', () => {
    expect(
      GlobalStateReducer(
        {
          contrastMode: '',
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setTheme(Theme.DARK)
      )
    ).toEqual({
      contrastMode: '',
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      kioskData: undefined,
      language: '',
      theme: Theme.DARK
    });
  });

  it('should set contrast mode', () => {
    expect(
      GlobalStateReducer(
        {
          contrastMode: ContrastMode.DEFAULT,
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          kioskData: undefined,
          language: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setContrastMode(ContrastMode.GLASS)
      )
    ).toEqual({
      contrastMode: ContrastMode.GLASS,
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      kioskData: undefined,
      language: '',
      theme: Theme.LIGHT
    });
  });
});
