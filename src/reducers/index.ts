import { combineReducers } from 'redux';

import namespaces from './Namespaces';
import serviceGraphFilterState from './ServiceGraphFilterState';
import { KialiAppState } from '../store/Store';
import messageCenter from './MessageCenter';
import serviceGraphDataState from './ServiceGraphDataState';

const rootReducer = combineReducers<KialiAppState>({
  messageCenter,
  namespaces,
  serviceGraphDataState,
  serviceGraphFilterState: serviceGraphFilterState
});

export default rootReducer;
