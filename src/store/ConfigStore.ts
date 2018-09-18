import { createStore, applyMiddleware, compose } from 'redux';
import { KialiAppState } from './Store';
import { persistStore, persistReducer } from 'redux-persist';
import rootReducer from '../reducers';
import thunk from 'redux-thunk';

// defaults to localStorage for web and AsyncStorage for react-native
import storage from 'redux-persist/lib/storage';

declare const window;

const persistConfig = {
  key: 'root',
  storage: storage,
  whitelist: ['authentication', 'statusState', 'userSettings']
};

const composeEnhancers =
  (process.env.NODE_ENV === 'development' && window && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose;

const configureStore = (initialState?: KialiAppState) => {
  // configure middlewares
  const middlewares = [thunk];
  // compose enhancers
  const enhancer = composeEnhancers(applyMiddleware(...middlewares));
  // persist reducers
  const persistentReducer = persistReducer(persistConfig, rootReducer);
  // the ts-ignore is needed with the new version of Redux 4.0
  // create store
  // @ts-ignore
  return createStore(persistentReducer, initialState, enhancer);
};

// pass an optional param to rehydrate state on app start
export const store = configureStore();
export const persistor = persistStore(store);
