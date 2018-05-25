import { combineReducers } from 'redux';
import namespaces from './Namespaces';
import { KialiAppState } from '../store/Store';
import messageCenter from './MessageCenter';
import serviceGraphDataState from './ServiceGraphDataState';

const rootReducer = combineReducers<KialiAppState>({
  messageCenter,
  namespaces,
  serviceGraph: serviceGraphDataState
});

export default rootReducer;
