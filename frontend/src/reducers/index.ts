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
import { TracingStateReducer } from './TracingState';
import { MetricsStatsStateReducer } from './MetricsStatsState';
import { IstioCertsInfoStateReducer } from './IstioCertsInfoState';
import { MeshDataStateReducer } from './MeshDataState';

export const rootReducer = combineReducers<KialiAppState, KialiAppAction>({
  authentication: LoginStateReducer,
  clusters: ClusterStateReducer,
  globalState: GlobalStateReducer,
  graph: GraphDataStateReducer,
  istioStatus: IstioStatusStateReducer,
  istioCertsInfo: IstioCertsInfoStateReducer,
  mesh: MeshDataStateReducer,
  meshTLSStatus: MeshTlsStateReducer,
  messageCenter: MessageCenterReducer,
  metricsStats: MetricsStatsStateReducer,
  namespaces: NamespaceStateReducer,
  statusState: HelpDropdownStateReducer,
  tourState: TourStateReducer,
  tracingState: TracingStateReducer,
  userSettings: UserSettingsStateReducer
});
