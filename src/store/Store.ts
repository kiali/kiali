// Store is the Redux Data store

// Various pages are described here with their various sections
export interface ServiceGraphState {
  showEdgeLabels: boolean;
  showNodeLabels: boolean;
}

// @todo: Add namespaces interface

// This defines the Kiali Global Application State
export interface KialiAppState {
  // page settings
  namespaces: any;
  serviceGraphState: ServiceGraphState;
}
