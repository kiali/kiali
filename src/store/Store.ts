import { NotificationGroup } from '../types/MessageCenter';
import Namespace from '../types/Namespace';
import {
  DurationInSeconds,
  IntervalInMilliseconds,
  RawDate,
  ReplayWindow,
  TimeInMilliseconds,
  UserName
} from '../types/Common';
import { EdgeLabelMode, GraphDefinition, GraphType, Layout, NodeParamsType, SummaryData } from '../types/Graph';
import { TLSStatus } from '../types/TLSStatus';
import { StatusState } from '../types/StatusState';
import { TourInfo } from 'components/Tour/TourStop';
import { ComponentStatus } from '../types/IstioStatus';
import { JaegerState } from 'reducers/JaegerState';

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
export interface GraphToolbarState {
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
  showOperationNodes: boolean;
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
  graphDefinition: GraphDefinition | null; // Not for consumption. Only for "Debug" dialog.
  layout: Layout;
  node?: NodeParamsType;
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
  status: LoginStatus;
  session?: LoginSession;
  message: string;
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
  replayWindow: ReplayWindow;
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
  istioStatus: ComponentStatus[];
  /** Page Settings */
  authentication: LoginState;
  messageCenter: MessageCenterState;
  namespaces: NamespaceState;
  graph: GraphState;
  /** User Settings */
  userSettings: UserSettings;
  /** Jaeger Settings */
  jaegerState: JaegerState;
  tourState: TourState;
}
