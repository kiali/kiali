import globalState from '../GlobalState';
import { GlobalActionKeys } from '../../actions/GlobalActions';

describe('GlobalState reducer', () => {
  it('should return the initial state', () => {
    expect(globalState(undefined, {})).toEqual({
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
        {
          type: GlobalActionKeys.INCREMENT_LOADING_COUNTER
        }
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
        {
          type: GlobalActionKeys.DECREMENT_LOADING_COUNTER
        }
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
        {
          type: GlobalActionKeys.INCREMENT_LOADING_COUNTER
        }
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
        {
          type: GlobalActionKeys.DECREMENT_LOADING_COUNTER
        }
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
        {
          type: GlobalActionKeys.SET_PAGE_VISIBILITY_VISIBLE
        }
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
        {
          type: GlobalActionKeys.SET_PAGE_VISIBILITY_HIDDEN
        }
      )
    ).toEqual({
      loadingCounter: 0,
      isPageVisible: false
    });
  });
});
