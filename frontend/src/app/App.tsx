import axios from 'axios';
import * as React from 'react';
import { PersistGate } from 'redux-persist/lib/integration/react';
import { Provider } from 'react-redux';
import { GlobalActions } from '../actions/GlobalActions';
import { Navigation } from '../components/Nav/Navigation';
import { persistor, store } from '../store/ConfigStore';
import { AuthenticationController } from './AuthenticationController';
import { InitializingScreen } from './InitializingScreen';
import { StartupInitializer } from './StartupInitializer';
import { LoginPage } from '../pages/Login/LoginPage';
import { LoginActions } from '../actions/LoginActions';

const syncPageVisibilityToStore = (): void => {
  // visible | hidden | prerender — treat prerender like hidden.
  if (document.visibilityState === 'visible') {
    store.dispatch(GlobalActions.setPageVisibilityVisible());
  } else {
    store.dispatch(GlobalActions.setPageVisibilityHidden());
  }
};

document.addEventListener('visibilitychange', syncPageVisibilityToStore);
syncPageVisibilityToStore();

const getIsLoadingState = (): boolean => {
  const state = store.getState();
  return state && state.globalState.loadingCounter > 0;
};

const decrementLoadingCounter = (): void => {
  if (getIsLoadingState()) {
    store.dispatch(GlobalActions.decrementLoadingCounter());
  }
};

const openshift_token: string | null = (function () {
  const urlParams = new URLSearchParams(document.location.search);
  const token = urlParams.get('oauth_token');

  // Prevent token leakage via browser history, Referer headers, and proxy logs
  if (token) {
    urlParams.delete('oauth_token');
    const cleanSearch = urlParams.toString();
    const newUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '') + window.location.hash;
    window.history.replaceState(window.history.state, '', newUrl);
  }

  return token;
})();

// intercept all Axios requests and dispatch the INCREMENT_LOADING_COUNTER Action
axios.interceptors.request.use(
  request => {
    // dispatch an action to turn spinner on
    store.dispatch(GlobalActions.incrementLoadingCounter());

    // Set OpenShift token, if available.
    if (openshift_token) {
      request.headers.Authorization = `Bearer ${openshift_token}`;
    }

    return request;
  },
  error => {
    console.info(error);
    return Promise.reject(error);
  }
);

// intercept all Axios responses and dispatch the DECREMENT_LOADING_COUNTER Action
axios.interceptors.response.use(
  response => {
    decrementLoadingCounter();
    return response;
  },
  error => {
    // The response was rejected, turn off the spinning
    decrementLoadingCounter();

    if (error.response.status === 401) {
      store.dispatch(LoginActions.sessionExpired());
    }

    return Promise.reject(error);
  }
);

export const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = React.useState<boolean>(false);

  return (
    <React.Suspense fallback={<InitializingScreen />}>
      <Provider store={store}>
        <PersistGate loading={<InitializingScreen />} persistor={persistor}>
          {isInitialized ? (
            <AuthenticationController
              publicAreaComponent={(isPostLoginPerforming: boolean, errorMsg?: string) => (
                <LoginPage isPostLoginPerforming={isPostLoginPerforming} postLoginErrorMsg={errorMsg} />
              )}
              protectedAreaComponent={<Navigation />}
            />
          ) : (
            <StartupInitializer onInitializationFinished={() => setIsInitialized(true)} />
          )}
        </PersistGate>
      </Provider>
    </React.Suspense>
  );
};
