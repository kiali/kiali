import globalState from '../GlobalState';
import { GlobalActionKeys } from '../../actions/GlobalActions';

describe('GlobalState reducer', () => {
  it('should return the initial state', () => {
    expect(globalState(undefined, {})).toEqual({
      isLoading: false
    });
  });

  it('should turn Loading spinner On', () => {
    expect(
      globalState(
        {
          isLoading: false
        },
        {
          type: GlobalActionKeys.LOADING_SPINNER_ON
        }
      )
    ).toEqual({
      isLoading: true
    });
  });

  it('should turn Loading spinner off', () => {
    expect(
      globalState(
        {
          isLoading: true
        },
        {
          type: GlobalActionKeys.LOADING_SPINNER_OFF
        }
      )
    ).toEqual({
      isLoading: false
    });
  });

  it('should turn Toggle Loading spinner ', () => {
    expect(
      globalState(
        {
          isLoading: true
        },
        {
          type: GlobalActionKeys.TOGGLE_LOADING_SPINNER
        }
      )
    ).toEqual({
      isLoading: false
    });
  });

  it('should set Toggle Loading spinner ', () => {
    expect(
      globalState(
        {
          isLoading: true
        },
        {
          type: GlobalActionKeys.SET_LOADING_SPINNER,
          payload: false
        }
      )
    ).toEqual({
      isLoading: false
    });
  });
});
