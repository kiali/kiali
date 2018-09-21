import { NotificationGroup } from '../types/MessageCenter';
import { PollIntervalInMs } from '../types/Common';
// Store is the Redux Data store

export interface GlobalState {
  readonly loadingCounter: number;
  readonly isPageVisible: boolean;
}

// Various pages are described here with their various sections
export interface GraphFilterState {
  // Toggle props
  readonly showLegend: boolean;
  readonly showNodeLabels: boolean;
  readonly showCircuitBreakers: boolean;
  readonly showVirtualServices: boolean;
  readonly showMissingSidecars: boolean;
  readonly showTrafficAnimation: boolean;
  readonly showServiceNodes: boolean;
  readonly refreshRate: PollIntervalInMs;
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
  version: string;
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
}
// @todo: Add namespaces interface

// This defines the Kiali Global Application State
export interface KialiAppState {
  // Global state === across multiple pages
  // could also be session state
  globalState: GlobalState;
  statusState: StatusState;
  /** Page Settings */
  authentication: LoginState;
  messageCenter: MessageCenterState;
  namespaces: any;
  graph: GraphState;
  /** User Settings */
  userSettings: UserSettings;
}
