import { combineReducers } from 'redux';

import { KialiAppState } from '../store/Store';
import messageCenter from './MessageCenter';
import loginState from './LoginState';
import HelpDropdownState from './HelpDropdownState';
import graphDataState from './GraphDataState';
import globalState from './GlobalState';
import namespaceState from './NamespaceState';
import UserSettingsState from './UserSettingsState';
import JaegerState from './JaegerState';
import TourState from './TourState';
import { KialiAppAction } from '../actions/KialiAppAction';
import MeshTlsState from './MeshTlsState';

const rootReducer = combineReducers<KialiAppState, KialiAppAction>({
  authentication: loginState,
  globalState: globalState,
  graph: graphDataState,
  messageCenter,
  namespaces: namespaceState,
  statusState: HelpDropdownState,
  userSettings: UserSettingsState,
  jaegerState: JaegerState,
  meshTLSStatus: MeshTlsState,
  tourState: TourState
});

export default rootReducer;
