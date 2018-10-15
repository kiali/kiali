import { combineReducers } from 'redux';

import { KialiAppState } from '../store/Store';
import messageCenter from './MessageCenter';
import LoginState from './LoginState';
import HelpDropdownState from './HelpDropdownState';
import graphDataState from './GraphDataState';
import globalState from './GlobalState';
import namespaceState from './NamespaceState';
import UserSettingsState from './UserSettingsState';

const rootReducer = combineReducers<KialiAppState>({
  authentication: LoginState,
  statusState: HelpDropdownState,
  messageCenter,
  namespaces: namespaceState,
  globalState: globalState,
  graph: graphDataState,
  userSettings: UserSettingsState
});

export default rootReducer;
