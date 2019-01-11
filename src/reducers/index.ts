import { combineReducers } from 'redux';

import { KialiAppState } from '../store/Store';
import messageCenter from './MessageCenter';
import loginState from './LoginState';
import HelpDropdownState from './HelpDropdownState';
import graphDataState from './GraphDataState';
import globalState from './GlobalState';
import namespaceState from './NamespaceState';
import UserSettingsState from './UserSettingsState';
import GrafanaState from './GrafanaState';
import { KialiAppAction } from '../actions/KialiAppAction';

const rootReducer = combineReducers<KialiAppState, KialiAppAction>({
  authentication: loginState,
  statusState: HelpDropdownState,
  messageCenter,
  namespaces: namespaceState,
  globalState: globalState,
  graph: graphDataState,
  userSettings: UserSettingsState,
  grafanaInfo: GrafanaState
});

export default rootReducer;
