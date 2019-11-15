import { NotificationGroup } from '../types/MessageCenter';
import Namespace from '../types/Namespace';
import {
  DurationInSeconds,
  PollIntervalInMs,
  TimeInSeconds,
  UserName,
  RawDate,
  TimeInMilliseconds
} from '../types/Common';
import { EdgeLabelMode, Layout } from '../types/GraphFilter';
import { GraphType, NodeParamsType, SummaryData, CyData, GraphElements } from '../types/Graph';
import { TLSStatus } from '../types/TLSStatus';
import { StatusState } from '../types/StatusState';
import { TourInfo } from 'components/Tour/TourStop';

// Store is the Redux Data store

export interface GlobalState {
  readonly loadingCounter: number;
  readonly isPageVisible: boolean;
  lastRefreshAt: TimeInMilliseconds;
}

export interface NamespaceState {
  readonly activeNamespaces: Namespace[];
  readonly items?: Namespace[];
  readonly isFetching: boolean;
  readonly lastUpdated?: Date;
  readonly filter: string;
}

// Various pages are described here with their various sections
export interface GraphFilterState {
  // dropdown props
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  // find props
  findValue: string;
  hideValue: string;
  showFindHelp: boolean;
  // Toggle props
  compressOnHide: boolean;
  showCircuitBreakers: boolean;
  showLegend: boolean;
  showMissingSidecars: boolean;
  showNodeLabels: boolean;
  showSecurity: boolean;
  showServiceNodes: boolean;
  showTrafficAnimation: boolean;
  showUnusedNodes: boolean;
  showVirtualServices: boolean;
}

export interface MessageCenterState {
  nextId: number; // This likely will go away once we have persistence
  groups: NotificationGroup[];
  hidden: boolean;
  expanded: boolean;
  expandedGroupId?: string;
}

export interface GraphState {
  // cyData is updated when the graph is fully rendered (i.e. after refresh)
  cyData: CyData | null;
  isLoading: boolean;
  isError: boolean;
  error?: string; // the error message to show from loading graph
  graphDataDuration: DurationInSeconds;
  graphDataTimestamp: TimeInSeconds;
  graphData: GraphElements;
  filterState: GraphFilterState;
  layout: Layout;
  node?: NodeParamsType;
  summaryData: SummaryData | null;
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
  status: LoginStatus;
  session?: LoginSession;
  message: string;
}

export interface InterfaceSettings {
  navCollapse: boolean;
}

export interface UserSettings {
  interface: InterfaceSettings;
  refreshInterval: PollIntervalInMs;
  duration: DurationInSeconds;
}

export interface JaegerState {
  jaegerURL: string;
  enableIntegration: boolean;
  namespaceSelector: boolean;
}

export interface TourState {
  activeTour?: TourInfo;
  activeStop?: number; // index into the TourInfo.stops array
}

// This defines the Kiali Global Application State
export interface KialiAppState {
  // Global state === across multiple pages
  // could also be session state
  globalState: GlobalState;
  statusState: StatusState;
  meshTLSStatus: TLSStatus;
  /** Page Settings */
  authentication: LoginState;
  messageCenter: MessageCenterState;
  namespaces: NamespaceState;
  graph: GraphState;
  /** User Settings */
  userSettings: UserSettings;
  /** Jaeger Integration */
  jaegerState: JaegerState | null;
  tourState: TourState;
}
