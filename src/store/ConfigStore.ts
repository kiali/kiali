import { createStore, applyMiddleware, compose } from 'redux';
import { KialiAppState } from './Store';
import rootReducer from '../reducers';
import logger from 'redux-logger';
import thunk from 'redux-thunk';

declare const window;

const composeEnhancers =
  (process.env.NODE_ENV === 'development' && window && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose;

const configureStore = (initialState?: KialiAppState) => {
  // configure middlewares
  const middlewares = [thunk, logger];
  // compose enhancers
  const enhancer = composeEnhancers(applyMiddleware(...middlewares));
  // create store
  return createStore(rootReducer, initialState, enhancer);
};

// pass an optional param to rehydrate state on app start
const store = configureStore();

// export store singleton instance
export default store;
