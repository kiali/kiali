import { NotificationGroup } from '../types/MessageCenter';
import { PollIntervalInMs } from '../types/GraphFilter';
// Store is the Redux Data store

export interface GlobalState {
  readonly loadingCounter: number;
  readonly isPageVisible: boolean;
}

// Various pages are described here with their various sections
export interface ServiceGraphFilterState {
  // Toggle props
  readonly showLegend: boolean;
  readonly showNodeLabels: boolean;
  readonly showCircuitBreakers: boolean;
  readonly showVirtualServices: boolean;
  readonly showMissingSidecars: boolean;
  readonly showTrafficAnimation: boolean;
  readonly refreshRate: PollIntervalInMs;
}

export interface MessageCenterState {
  nextId: number; // This likely will go away once we have persistence
  groups: NotificationGroup[];
  hidden: boolean;
  expanded: boolean;
  expandedGroupId?: string;
}

export interface ServiceGraphState {
  isLoading: boolean;
  isError: boolean;
  graphDataTimestamp: number;
  graphData: any;
  filterState: ServiceGraphFilterState;
  sidePanelInfo: {
    kind: string;
    graphReference: any;
  } | null;
  hideLegend: boolean;
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
  serviceGraph: ServiceGraphState;
  /** User Settings */
  userSettings: UserSettings;
}
