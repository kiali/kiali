import { combineReducers } from 'redux';

import { KialiAppState } from '../store/Store';
import { MessageCenterReducer } from './MessageCenter';
import { LoginStateReducer } from './LoginState';
import { HelpDropdownStateReducer } from './HelpDropdownState';
import { GraphDataStateReducer } from './GraphDataState';
import { GlobalStateReducer } from './GlobalState';
import { NamespaceStateReducer } from './NamespaceState';
import { ClusterStateReducer } from './ClusterState';
import { UserSettingsStateReducer } from './UserSettingsState';
import { TourStateReducer } from './TourState';
import { KialiAppAction } from '../actions/KialiAppAction';
import { MeshTlsStateReducer } from './MeshTlsState';
import { IstioStatusStateReducer } from './IstioStatusState';
import { JaegerStateReducer } from './JaegerState';
import { MetricsStatsStateReducer } from './MetricsStatsState';
import { IstioCertsInfoStateReducer } from './IstioCertsInfoState';

export const rootReducer = combineReducers<KialiAppState, KialiAppAction>({
  authentication: LoginStateReducer,
  globalState: GlobalStateReducer,
  graph: GraphDataStateReducer,
  messageCenter: MessageCenterReducer,
  namespaces: NamespaceStateReducer,
  clusters: ClusterStateReducer,
  statusState: HelpDropdownStateReducer,
  userSettings: UserSettingsStateReducer,
  jaegerState: JaegerStateReducer,
  meshTLSStatus: MeshTlsStateReducer,
  istioStatus: IstioStatusStateReducer,
  istioCertsInfo: IstioCertsInfoStateReducer,
  tourState: TourStateReducer,
  metricsStats: MetricsStatsStateReducer
});
