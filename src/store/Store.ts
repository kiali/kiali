import { NotificationGroup } from '../types/MessageCenter';
import { EdgeLabelMode } from '../types/GraphFilter';
// Store is the Redux Data store

export interface GlobalState {
  readonly isLoading: boolean;
}

// Various pages are described here with their various sections
export interface ServiceGraphFilterState {
  // Toggle props
  readonly showNodeLabels: boolean;
  readonly showCircuitBreakers: boolean;
  readonly showRouteRules: boolean;
  readonly showMissingSidecars: boolean;
  readonly showTrafficAnimation: boolean;
  // disable the service graph layers toolbar
  // @todo: add this back in later
  // readonly disableLayers: boolean;

  readonly edgeLabelMode: EdgeLabelMode;
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
  graphDataTimestamp: number;
  graphData: any;
  filterState: ServiceGraphFilterState;
  sidePanelInfo: {
    kind: string;
    graphReference: any;
  } | null;
  hideLegend: boolean;
}

// @todo: Add namespaces interface

// This defines the Kiali Global Application State
export interface KialiAppState {
  // Global state === across multiple pages
  // could also be session state
  globalState: GlobalState;
  // page settings
  messageCenter: MessageCenterState;
  namespaces: any;
  serviceGraph: ServiceGraphState;
}
