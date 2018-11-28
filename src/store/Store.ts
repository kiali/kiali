import { NotificationGroup } from '../types/MessageCenter';
import Namespace from '../types/Namespace';
import { DurationInSeconds, PollIntervalInMs } from '../types/Common';
import { EdgeLabelMode, Layout } from '../types/GraphFilter';
import { GraphType, NodeParamsType } from '../types/Graph';

// Store is the Redux Data store

export interface GlobalState {
  readonly loadingCounter: number;
  readonly isPageVisible: boolean;
}

export interface NamespaceState {
  readonly activeNamespaces: Namespace[];
  readonly items?: string[];
  readonly isFetching: boolean;
  readonly lastUpdated?: Date;
}

// Various pages are described here with their various sections
export interface GraphFilterState {
  // dropdown props
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  // Toggle props
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
  isLoading: boolean;
  isError: boolean;
  error?: string; // the error message to show from loading graph
  graphDataTimestamp: number;
  graphData: any;
  filterState: GraphFilterState;
  layout: Layout;
  node?: NodeParamsType;
  sidePanelInfo: {
    kind: string;
    graphReference: any;
  } | null;
}

export interface Token {
  token: string;
  expired_at: string;
}
export interface LoginState {
  token?: Token;
  username?: string;
  error: any;
  message: string;
  logged: boolean;
  logging: boolean;
  sessionTimeOut?: Date;
}

export interface Component {
  name: string;
  version?: string;
  url?: string;
}

export interface StatusState {
  status: { [key: string]: string };
  components: Component[];
  warningMessages: string[];
}

export interface InterfaceSettings {
  navCollapse: boolean;
}

export interface UserSettings {
  interface: InterfaceSettings;
  refreshInterval: PollIntervalInMs;
  duration: DurationInSeconds;
}

export interface GrafanaInfo {
  url: string;
  serviceDashboardPath: string;
  workloadDashboardPath: string;
  varNamespace: string;
  varService: string;
  varWorkload: string;
}

// This defines the Kiali Global Application State
export interface KialiAppState {
  // Global state === across multiple pages
  // could also be session state
  globalState: GlobalState;
  grafanaInfo?: GrafanaInfo;
  statusState: StatusState;
  /** Page Settings */
  authentication: LoginState;
  messageCenter: MessageCenterState;
  namespaces: NamespaceState;
  graph: GraphState;
  /** User Settings */
  userSettings: UserSettings;
}
