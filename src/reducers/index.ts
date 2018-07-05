import { combineReducers } from 'redux';

import namespaces from './Namespaces';
import { KialiAppState } from '../store/Store';
import messageCenter from './MessageCenter';
import LoginState from './LoginState';
import HelpDropdownState from './HelpDropdownState';
import serviceGraphDataState from './ServiceGraphDataState';
import globalState from './GlobalState';
import UserSettingsState from './UserSettingsState';

const rootReducer = combineReducers<KialiAppState>({
  authentication: LoginState,
  statusState: HelpDropdownState,
  messageCenter,
  namespaces,
  globalState: globalState,
  serviceGraph: serviceGraphDataState,
  userSettings: UserSettingsState
});

export default rootReducer;
