import { NotificationGroup } from '../types/MessageCenter';
import { EdgeLabelMode, PollIntervalInMs } from '../types/GraphFilter';
// Store is the Redux Data store

export interface GlobalState {
  readonly isLoading: boolean;
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
  // disable the service graph layers toolbar
  // @todo: add this back in later
  // readonly disableLayers: boolean;

  readonly edgeLabelMode: EdgeLabelMode;
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
  token: Token | undefined;
  username: string | undefined;
  error: any;
  message: string;
  logged: boolean;
  logging: boolean;
}
// @todo: Add namespaces interface

// This defines the Kiali Global Application State
export interface KialiAppState {
  // Global state === across multiple pages
  // could also be session state
  globalState: GlobalState;
  // page settings
  authentication: LoginState;
  messageCenter: MessageCenterState;
  namespaces: any;
  serviceGraph: ServiceGraphState;
}
