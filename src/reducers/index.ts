import { combineReducers } from 'redux';

import namespaces from './namespaces';
import serviceGraphState from './ServiceGraphState';

const rootReducer = combineReducers({
  namespaces,
  serviceGraphState
});

export default rootReducer;
