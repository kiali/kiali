import globalState from '../GlobalState';
import { GlobalActionKeys } from '../../actions/GlobalActions';

describe('GlobalState reducer', () => {
  it('should return the initial state', () => {
    expect(globalState(undefined, {})).toEqual({
      loadingCounter: 0
    });
  });

  it('should turn Loading spinner On', () => {
    expect(
      globalState(
        {
          loadingCounter: 0
        },
        {
          type: GlobalActionKeys.INCREMENT_LOADING_COUNTER
        }
      )
    ).toEqual({
      loadingCounter: 1
    });
  });

  it('should turn Loading spinner off', () => {
    expect(
      globalState(
        {
          loadingCounter: 1
        },
        {
          type: GlobalActionKeys.DECREMENT_LOADING_COUNTER
        }
      )
    ).toEqual({
      loadingCounter: 0
    });
  });

  it('should increment counter', () => {
    expect(
      globalState(
        {
          loadingCounter: 1
        },
        {
          type: GlobalActionKeys.INCREMENT_LOADING_COUNTER
        }
      )
    ).toEqual({
      loadingCounter: 2
    });
  });

  it('should decrement counter', () => {
    expect(
      globalState(
        {
          loadingCounter: 2
        },
        {
          type: GlobalActionKeys.DECREMENT_LOADING_COUNTER
        }
      )
    ).toEqual({
      loadingCounter: 1
    });
  });
});
