import { combineReducers } from 'redux';

import { KialiAppState } from '../store/Store';
import messageCenter from './MessageCenter';
import loginState from './LoginState';
import HelpDropdownState from './HelpDropdownState';
import graphDataState from './GraphDataState';
import globalState from './GlobalState';
import namespaceState from './NamespaceState';
import serverConfig from './ServerConfigState';
import UserSettingsState from './UserSettingsState';
import GrafanaState from './GrafanaState';
import JaegerState from './JaegerState';
import { KialiAppAction } from '../actions/KialiAppAction';

const rootReducer = combineReducers<KialiAppState, KialiAppAction>({
  authentication: loginState,
  globalState: globalState,
  grafanaInfo: GrafanaState,
  graph: graphDataState,
  messageCenter,
  namespaces: namespaceState,
  serverConfig: serverConfig,
  statusState: HelpDropdownState,
  userSettings: UserSettingsState,
  jaegerState: JaegerState
});

export default rootReducer;
