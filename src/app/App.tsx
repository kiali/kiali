import * as React from 'react';
import { Router, withRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import './App.css';
import Navigation from '../containers/NavigationContainer';
import { store, persistor } from '../store/ConfigStore';
import axios from 'axios';
import { globalActions } from '../actions/GlobalActions';
import history from './History';
import { PersistGate } from 'redux-persist/lib/integration/react';

const getIsLoadingState = () => {
  const state = store.getState();
  return state && state.globalState.loadingCounter > 0;
};

const decrementLoadingCounter = () => {
  if (getIsLoadingState()) {
    store.dispatch(globalActions.decrementLoadingCounter());
  }
};

// intercept all Axios requests and dispatch the INCREMENT_LOADING_COUNTER Action
axios.interceptors.request.use(
  request => {
    // dispatch an action to turn spinner on
    store.dispatch(globalActions.incrementLoadingCounter());
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
    return Promise.reject(error);
  }
);

const Loading = () => {
  return <div>Loading</div>;
};

class App extends React.Component {
  render() {
    const Sidebar = withRouter(Navigation);
    return (
      <Provider store={store}>
        <PersistGate loading={<Loading />} persistor={persistor}>
          <Router history={history}>
            <Sidebar />
          </Router>
        </PersistGate>
      </Provider>
    );
  }
}

export default App;
