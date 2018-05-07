import { combineReducers } from 'redux';

import messageCenter from './MessageCenter';
import namespaces from './namespaces';
import serviceGraphState from './ServiceGraphState';

const rootReducer = combineReducers({
  messageCenter,
  namespaces,
  serviceGraphState
});

export default rootReducer;
