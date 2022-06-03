import globalState from '../GlobalState';
import { GlobalActions } from '../../actions/GlobalActions';

describe('GlobalState reducer', () => {
  const RealDate = Date.now;
  const currentDate = Date.now();

  const mockDate = date => {
    global.Date.now = jest.fn(() => date) as any;
    return date;
  };

  beforeEach(() => {
    mockDate(currentDate);
  });

  afterEach(() => {
    global.Date.now = RealDate;
  });

  it('should return the initial state', () => {
    expect(globalState(undefined, GlobalActions.unknown())).toEqual({
      loadingCounter: 0,
      isPageVisible: true,
      isKiosk: false,
      kiosk: '',
      lastRefreshAt: 0
    });
  });

  it('should turn Loading spinner On', () => {
    expect(
      globalState(
        {
          loadingCounter: 0,
          isPageVisible: true,
          isKiosk: false,
          kiosk: '',
          lastRefreshAt: currentDate
        },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 1,
      isPageVisible: true,
      isKiosk: false,
      kiosk: '',
      lastRefreshAt: currentDate
    });
  });

  it('should turn Loading spinner off', () => {
    expect(
      globalState(
        {
          loadingCounter: 1,
          isPageVisible: true,
          isKiosk: false,
          kiosk: '',
          lastRefreshAt: currentDate
        },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: true,
      isKiosk: false,
      kiosk: '',
      lastRefreshAt: currentDate
    });
  });

  it('should increment counter', () => {
    expect(
      globalState(
        {
          loadingCounter: 1,
          isPageVisible: true,
          isKiosk: false,
          kiosk: '',
          lastRefreshAt: currentDate
        },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 2,
      isPageVisible: true,
      isKiosk: false,
      kiosk: '',
      lastRefreshAt: currentDate
    });
  });

  it('should decrement counter', () => {
    expect(
      globalState(
        {
          loadingCounter: 2,
          isPageVisible: true,
          isKiosk: false,
          kiosk: '',
          lastRefreshAt: currentDate
        },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 1,
      isPageVisible: true,
      isKiosk: false,
      kiosk: '',
      lastRefreshAt: currentDate
    });
  });
  it('should turn on page visibility status', () => {
    expect(
      globalState(
        {
          loadingCounter: 0,
          isPageVisible: false,
          isKiosk: false,
          kiosk: '',
          lastRefreshAt: currentDate
        },
        GlobalActions.setPageVisibilityVisible()
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: true,
      isKiosk: false,
      kiosk: '',
      lastRefreshAt: currentDate
    });
  });
  it('should turn off page visibility status', () => {
    expect(
      globalState(
        {
          loadingCounter: 0,
          isPageVisible: true,
          isKiosk: false,
          kiosk: '',
          lastRefreshAt: currentDate
        },
        GlobalActions.setPageVisibilityHidden()
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: false,
      isKiosk: false,
      kiosk: '',
      lastRefreshAt: currentDate
    });
  });
  it('should turn on kiosk status', () => {
    expect(
      globalState(
        {
          loadingCounter: 0,
          isPageVisible: true,
          isKiosk: false,
          kiosk: '',
          lastRefreshAt: currentDate
        },
        GlobalActions.setKiosk('test')
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: true,
      isKiosk: true,
      kiosk: 'test',
      lastRefreshAt: currentDate
    });
  });
});
