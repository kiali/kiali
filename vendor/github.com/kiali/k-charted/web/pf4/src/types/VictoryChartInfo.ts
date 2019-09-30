import { ChartLineProps } from '@patternfly/react-charts';

export interface LegendItem {
  name: string;
}

export interface LegendInfo {
  height: number;
  itemsPerRow: number;
  items: LegendItem[];
}

export interface VictoryChartInfo {
  rawLegend: string[];
  series: ChartLineProps[][];
}
