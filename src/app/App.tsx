import * as React from 'react';
import { Router, withRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import './App.css';
import Navigation from '../containers/NavigationContainer';
import { store, persistor } from '../store/ConfigStore';
import axios from 'axios';
import { GlobalActionKeys } from '../actions/GlobalActions';
import history from './History';
import { PersistGate } from 'redux-persist/lib/integration/react';

// intercept all Axios requests and dispatch the LOADING_SPINNER_ON Action
axios.interceptors.request.use(
  request => {
    // dispatch an action to turn spinner on
    let state = store.getState();
    if (state && !state.globalState.isLoading) {
      store.dispatch({ type: GlobalActionKeys.LOADING_SPINNER_ON });
    }
    return request;
  },
  error => {
    console.log(error);
    return Promise.reject(error);
  }
);

// intercept all Axios responses and dispatch the LOADING_SPINNER_OFF Action
axios.interceptors.response.use(
  response => {
    let state = store.getState();
    if (state && state.globalState.isLoading) {
      store.dispatch({ type: GlobalActionKeys.LOADING_SPINNER_OFF });
    }
    return response;
  },
  error => {
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
