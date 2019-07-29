import { ChartLineProps } from '@patternfly/react-charts';

export interface VictoryChartLegendItem {
  name: string;
}

export interface VictoryChartInfo {
  legend: VictoryChartLegendItem[];
  series: ChartLineProps[][];
}
