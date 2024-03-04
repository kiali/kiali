import { NotificationGroup } from '../types/MessageCenter';
import { Namespace } from '../types/Namespace';
import {
  DurationInSeconds,
  IntervalInMilliseconds,
  RawDate,
  TimeInMilliseconds,
  TimeRange,
  UserName
} from '../types/Common';
import {
  EdgeLabelMode,
  EdgeMode,
  GraphDefinition,
  GraphType,
  Layout,
  NodeParamsType,
  RankMode,
  RankResult,
  SummaryData,
  TrafficRate
} from '../types/Graph';
import { TLSStatus } from '../types/TLSStatus';
import { StatusState } from '../types/StatusState';
import { TourInfo } from 'components/Tour/TourStop';
import { ComponentStatus } from '../types/IstioStatus';
import { TracingState } from 'reducers/TracingState';
import { MetricsStatsState } from 'reducers/MetricsStatsState';
import { CertsInfo } from 'types/CertsInfo';
import { MeshCluster, MeshDefinition, MeshTarget } from '../types/Mesh';

// Store is the Redux Data store

export interface GlobalState {
  readonly isPageVisible: boolean;
  readonly kiosk: string;
  readonly language: string;
  readonly loadingCounter: number;
  readonly theme: string;
}

export interface ClusterState {
  readonly activeClusters: MeshCluster[];
  readonly filter: string;
}

export interface NamespaceState {
  readonly activeNamespaces: Namespace[];
  readonly filter: string;
  readonly isFetching: boolean;
  readonly items?: Namespace[];
  readonly lastUpdated?: Date;
  readonly namespacesPerCluster?: Map<string, string[]>;
}

// Various pages are described here with their various sections
export interface GraphToolbarState {
  // Toggle props
  boxByCluster: boolean;
  boxByNamespace: boolean;
  // dropdown props
  edgeLabels: EdgeLabelMode[];
  // find props
  findValue: string;
  graphType: GraphType;
  hideValue: string;
  rankBy: RankMode[];
  showFindHelp: boolean;
  showIdleEdges: boolean;
  showIdleNodes: boolean;
  showLegend: boolean;
  showOperationNodes: boolean;
  showOutOfMesh: boolean;
  showRank: boolean;
  showSecurity: boolean;
  showServiceNodes: boolean;
  showTrafficAnimation: boolean;
  showVirtualServices: boolean;
  showWaypoints: boolean;
  trafficRates: TrafficRate[];
}

export interface MessageCenterState {
  expanded: boolean;
  expandedGroupId?: string;
  groups: NotificationGroup[];
  hidden: boolean;
  nextId: number; // This likely will go away once we have persistence
}

export interface GraphState {
  edgeMode: EdgeMode;
  graphDefinition: GraphDefinition | null; // Not for consumption. Only for "Debug" dialog.
  layout: Layout;
  namespaceLayout: Layout;
  node?: NodeParamsType;
  rankResult: RankResult;
  summaryData: SummaryData | null;
  toolbarState: GraphToolbarState;
  updateTime: TimeInMilliseconds;
}

export enum LoginStatus {
  logging,
  loggedIn,
  loggedOut,
  error,
  expired
}

export interface LoginSession {
  expiresOn: RawDate;
  username: UserName;
}

export interface LoginState {
  landingRoute?: string;
  message: string;
  session?: LoginSession;
  status: LoginStatus;
}

export interface MeshToolbarState {
  // find props
  findValue: string;
  hideValue: string;
  showFindHelp: boolean;
  showLegend: boolean;
}

export interface MeshState {
  definition: MeshDefinition | null;
  layout: Layout;
  target: MeshTarget | null;
  toolbarState: MeshToolbarState;
  updateTime: TimeInMilliseconds;
}

export interface MessageCenterState {
  expanded: boolean;
  expandedGroupId?: string;
  groups: NotificationGroup[];
  hidden: boolean;
  nextId: number; // This likely will go away once we have persistence
}

export interface InterfaceSettings {
  navCollapse: boolean;
}

export interface UserSettings {
  duration: DurationInSeconds;
  interface: InterfaceSettings;
  refreshInterval: IntervalInMilliseconds;
  replayActive: boolean;
  replayQueryTime: TimeInMilliseconds;
  timeRange: TimeRange;
}

export interface TourState {
  activeStop?: number; // index into the TourInfo.stops array
  activeTour?: TourInfo;
}

// This defines the Kiali Global Application State
export interface KialiAppState {
  // Global state === across multiple pages
  // could also be session state
  /** Page Settings */
  authentication: LoginState;
  clusters: ClusterState;
  globalState: GlobalState;
  graph: GraphState;
  istioCertsInfo: CertsInfo[];
  istioStatus: ComponentStatus[];
  mesh: MeshState;
  /** Tracing Settings */
  meshTLSStatus: TLSStatus;
  messageCenter: MessageCenterState;
  metricsStats: MetricsStatsState;
  namespaces: NamespaceState;
  statusState: StatusState;
  tourState: TourState;
  tracingState: TracingState;
  /** User Settings */
  userSettings: UserSettings;
}
