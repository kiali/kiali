import { NotificationGroup } from '../types/MessageCenter';
// Store is the Redux Data store

// Various pages are described here with their various sections
export interface ServiceGraphFilterState {
  // Toggle props
  readonly showEdgeLabels: boolean;
  readonly showNodeLabels: boolean;
  readonly showCircuitBreakers: boolean;
  readonly showRouteRules: boolean;
  // disable the service graph layers toolbar
  // @todo: add this back in later
  // readonly disableLayers: boolean;
}

export interface MessageCenterState {
  nextId: number; // This likely will go away once we hace persistence
  groups: NotificationGroup[];
  hidden: boolean;
  expanded: boolean;
  expandedGroupId: string;
}

export interface ServiceGraphDataState {
  isLoading: boolean;
  timestamp: number;
  graphData: any;
}

// @todo: Add namespaces interface

// This defines the Kiali Global Application State
export interface KialiAppState {
  // page settings
  messageCenter: MessageCenterState;
  namespaces: any;
  serviceGraphDataState: ServiceGraphDataState;
  serviceGraphFilterState: ServiceGraphFilterState;
}
