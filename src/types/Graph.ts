import { Interval, Layout } from './GraphFilter';
import Namespace from './Namespace';

export interface SummaryPanelPropType {
  data: any;
  namespace: string;
  duration: string;
  step: number;
  rateInterval: string;
}

export interface GraphParamsType {
  namespace: Namespace;
  graphInterval: Interval;
  graphLayout: Layout;
}
