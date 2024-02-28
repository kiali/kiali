import { GlobalStateReducer } from '../GlobalState';
import { GlobalActions } from '../../actions/GlobalActions';
import { Locale, Theme } from 'types/Common';

describe('GlobalStateReducer reducer', () => {
  const RealDate = Date.now;
  const currentDate = Date.now();

  const mockDate = (date: number): number => {
    global.Date.now = jest.fn(() => date);

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
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      locale: '',
      theme: ''
    });
  });

  it('should turn Loading spinner On', () => {
    expect(
      GlobalStateReducer(
        {
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          locale: '',
          theme: Theme.LIGHT
        },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 1,
      isPageVisible: true,
      kiosk: '',
      locale: '',
      theme: Theme.LIGHT
    });
  });

  it('should turn Loading spinner off', () => {
    expect(
      GlobalStateReducer(
        {
          loadingCounter: 1,
          isPageVisible: true,
          kiosk: '',
          locale: '',
          theme: Theme.LIGHT
        },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      locale: '',
      theme: Theme.LIGHT
    });
  });

  it('should increment counter', () => {
    expect(
      GlobalStateReducer(
        {
          loadingCounter: 1,
          isPageVisible: true,
          kiosk: '',
          locale: '',
          theme: Theme.LIGHT
        },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 2,
      isPageVisible: true,
      kiosk: '',
      locale: '',
      theme: Theme.LIGHT
    });
  });

  it('should decrement counter', () => {
    expect(
      GlobalStateReducer(
        {
          loadingCounter: 2,
          isPageVisible: true,
          kiosk: '',
          locale: '',
          theme: Theme.LIGHT
        },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 1,
      isPageVisible: true,
      kiosk: '',
      locale: '',
      theme: Theme.LIGHT
    });
  });

  it('should turn on page visibility status', () => {
    expect(
      GlobalStateReducer(
        {
          loadingCounter: 0,
          isPageVisible: false,
          kiosk: '',
          locale: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setPageVisibilityVisible()
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      locale: '',
      theme: Theme.LIGHT
    });
  });

  it('should turn off page visibility status', () => {
    expect(
      GlobalStateReducer(
        {
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          locale: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setPageVisibilityHidden()
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: false,
      kiosk: '',
      locale: '',
      theme: Theme.LIGHT
    });
  });

  it('should turn on kiosk status', () => {
    expect(
      GlobalStateReducer(
        {
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          locale: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setKiosk('test')
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: 'test',
      locale: '',
      theme: Theme.LIGHT
    });
  });

  it('should switch to english language', () => {
    expect(
      GlobalStateReducer(
        {
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          locale: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setLocale(Locale.ENGLISH)
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      locale: Locale.ENGLISH,
      theme: Theme.LIGHT
    });
  });

  it('should turn on dark theme', () => {
    expect(
      GlobalStateReducer(
        {
          loadingCounter: 0,
          isPageVisible: true,
          kiosk: '',
          locale: '',
          theme: Theme.LIGHT
        },
        GlobalActions.setTheme(Theme.DARK)
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: true,
      kiosk: '',
      locale: '',
      theme: Theme.DARK
    });
  });
});
