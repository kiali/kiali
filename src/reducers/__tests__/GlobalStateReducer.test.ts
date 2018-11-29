import globalState from '../GlobalState';
import { GlobalActions } from '../../actions/GlobalActions';

describe('GlobalState reducer', () => {
  it('should return the initial state', () => {
    expect(globalState(undefined, GlobalActions.unknown())).toEqual({
      loadingCounter: 0,
      isPageVisible: true
    });
  });

  it('should turn Loading spinner On', () => {
    expect(
      globalState(
        {
          loadingCounter: 0,
          isPageVisible: true
        },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 1,
      isPageVisible: true
    });
  });

  it('should turn Loading spinner off', () => {
    expect(
      globalState(
        {
          loadingCounter: 1,
          isPageVisible: true
        },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: true
    });
  });

  it('should increment counter', () => {
    expect(
      globalState(
        {
          loadingCounter: 1,
          isPageVisible: true
        },
        GlobalActions.incrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 2,
      isPageVisible: true
    });
  });

  it('should decrement counter', () => {
    expect(
      globalState(
        {
          loadingCounter: 2,
          isPageVisible: true
        },
        GlobalActions.decrementLoadingCounter()
      )
    ).toEqual({
      loadingCounter: 1,
      isPageVisible: true
    });
  });
  it('should turn on page visibility status', () => {
    expect(
      globalState(
        {
          loadingCounter: 0,
          isPageVisible: false
        },
        GlobalActions.setPageVisibilityVisible()
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: true
    });
  });
  it('should turn off page visibility status', () => {
    expect(
      globalState(
        {
          loadingCounter: 0,
          isPageVisible: true
        },
        GlobalActions.setPageVisibilityHidden()
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: false
    });
  });
});
