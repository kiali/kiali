import { combineReducers } from 'redux';

import messageCenter from './MessageCenter';
import namespaces from './namespaces';
import serviceGraphState from './ServiceGraphState';
import serviceGraphDataState from './ServiceGraphDataState';

const rootReducer = combineReducers({
  messageCenter,
  namespaces,
  serviceGraphState,
  serviceGraphDataState
});

export default rootReducer;
