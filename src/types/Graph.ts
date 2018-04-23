import { Duration, Layout, BadgeStatus } from './GraphFilter';
import Namespace from './Namespace';

export interface SummaryPanelPropType {
  data: any;
  namespace: string;
  queryTime: string;
  duration: string;
  step: number;
  rateInterval: string;
}

export interface GraphParamsType {
  namespace: Namespace;
  graphDuration: Duration;
  graphLayout: Layout;
  badgeStatus: BadgeStatus;
}
