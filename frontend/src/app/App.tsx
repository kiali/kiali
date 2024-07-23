import axios from 'axios';
import * as React from 'react';
import { PersistGate } from 'redux-persist/lib/integration/react';
import { Provider } from 'react-redux';
import * as Visibility from 'visibilityjs';
import { GlobalActions } from '../actions/GlobalActions';
import { Navigation } from '../components/Nav/Navigation';
import { persistor, store } from '../store/ConfigStore';
import { AuthenticationController } from './AuthenticationController';
import { InitializingScreen } from './InitializingScreen';
import { StartupInitializer } from './StartupInitializer';
import { LoginPage } from '../pages/Login/LoginPage';
import { LoginActions } from '../actions/LoginActions';

Visibility.change((_e, state) => {
  // There are 3 states, visible, hidden and prerender, consider prerender as hidden.
  // https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState
  if (state === 'visible') {
    store.dispatch(GlobalActions.setPageVisibilityVisible());
  } else {
    store.dispatch(GlobalActions.setPageVisibilityHidden());
  }
});

if (Visibility.hidden()) {
  store.dispatch(GlobalActions.setPageVisibilityHidden());
} else {
  store.dispatch(GlobalActions.setPageVisibilityVisible());
}

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
  return urlParams.get('oauth_token');
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
