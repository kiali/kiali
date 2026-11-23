import { render } from '@testing-library/react';
import { GlobalActions } from '../../actions/GlobalActions';
import { store } from '../../store/ConfigStore';
import { App } from '../App';

const setDocumentVisibilityState = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state
  });
};

describe('App', () => {
  let nativeVisibilityState: DocumentVisibilityState;

  beforeEach(() => {
    nativeVisibilityState = document.visibilityState;
    process.env.REACT_APP_NAME = 'kiali-ui-test';
    process.env.REACT_APP_VERSION = '1.0.1';
    process.env.REACT_APP_GIT_HASH = '89323';
    store.dispatch(GlobalActions.setPageVisibilityVisible());
  });

  afterEach(() => {
    setDocumentVisibilityState(nativeVisibilityState);
  });

  it('renders full App without crashing', () => {
    render(<App />);
  });

  it('syncs page visibility state after mount', () => {
    setDocumentVisibilityState('hidden');
    render(<App />);
    expect(store.getState().globalState.isPageVisible).toBe(false);
  });
});
