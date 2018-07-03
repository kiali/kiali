import { combineReducers } from 'redux';

import namespaces from './Namespaces';
import { KialiAppState } from '../store/Store';
import messageCenter from './MessageCenter';
import LoginState from './LoginState';
import HelpDropdownState from './HelpDropdownState';
import serviceGraphDataState from './ServiceGraphDataState';
import globalState from './GlobalState';

const rootReducer = combineReducers<KialiAppState>({
  authentication: LoginState,
  statusState: HelpDropdownState,
  messageCenter,
  namespaces,
  globalState: globalState,
  serviceGraph: serviceGraphDataState
});

export default rootReducer;
