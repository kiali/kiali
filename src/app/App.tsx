import axios from 'axios';
import * as React from 'react';
import { PersistGate } from 'redux-persist/lib/integration/react';
import { Provider } from 'react-redux';
import { Router, withRouter } from 'react-router-dom';
import * as Visibility from 'visibilityjs';
import { GlobalActions } from '../actions/GlobalActions';
import NavigationContainer from '../components/Nav/Navigation';
import { store, persistor } from '../store/ConfigStore';
import AuthenticationControllerContainer from './AuthenticationController';
import history from './History';
import InitializingScreen from './InitializingScreen';
import StartupInitializer from './StartupInitializer';
import LoginPageContainer from '../pages/Login/LoginPage';
import { LoginActions } from '../actions/LoginActions';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/dist/themes/light-border.css';

/**
 * Use the Patternfly RCUE productized css styles if set by the environment
 * @example 'env REACT_APP_RCUE=true yarn start'
 */
const loadRcueCssIfNeeded = async (): Promise<void> => {
  // get the flag from command line if set: env REACT_APP_RCUE=true yarn start
  const useRcue = process.env.REACT_APP_RCUE;
  if (useRcue === 'true') {
    console.info('REACT_APP_RCUE set to true');
    Promise.all([require('patternfly/dist/css/rcue.css'), require('patternfly/dist/css/rcue-additions.css')]);
    console.info('Loaded RCUE css libraries loaded');
  }
};

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

const getIsLoadingState = () => {
  const state = store.getState();
  return state && state.globalState.loadingCounter > 0;
};

const decrementLoadingCounter = () => {
  if (getIsLoadingState()) {
    store.dispatch(GlobalActions.decrementLoadingCounter());
  }
};

// intercept all Axios requests and dispatch the INCREMENT_LOADING_COUNTER Action
axios.interceptors.request.use(
  request => {
    // dispatch an action to turn spinner on
    store.dispatch(GlobalActions.incrementLoadingCounter());
    return request;
  },
  error => {
    console.log(error);
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

type AppState = {
  isInitialized: boolean;
};

class App extends React.Component<{}, AppState> {
  private protectedArea: React.ReactNode;

  constructor(props: {}) {
    super(props);
    this.state = {
      isInitialized: false
    };
    loadRcueCssIfNeeded();

    const Navigator = withRouter(NavigationContainer);
    this.protectedArea = (
      <Router history={history}>
        <Navigator />
      </Router>
    );
  }

  render() {
    return (
      <Provider store={store}>
        <PersistGate loading={<InitializingScreen />} persistor={persistor}>
          {this.state.isInitialized ? (
            <AuthenticationControllerContainer
              publicAreaComponent={(isPostLoginPerforming: boolean, errorMsg?: string) => (
                <LoginPageContainer isPostLoginPerforming={isPostLoginPerforming} postLoginErrorMsg={errorMsg} />
              )}
              protectedAreaComponent={this.protectedArea}
            />
          ) : (
            <StartupInitializer onInitializationFinished={this.initializationFinishedHandler} />
          )}
        </PersistGate>
      </Provider>
    );
  }

  private initializationFinishedHandler = () => {
    this.setState({ isInitialized: true });
  };
}

export default App;
