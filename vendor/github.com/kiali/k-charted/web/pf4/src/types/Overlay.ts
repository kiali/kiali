import { VCLine } from './VictoryChartInfo';

export type OverlayInfo = {
  title: string,
  unit: string,
  dataStyle: any, // see "data" in https://formidable.com/open-source/victory/docs/common-props/#style
  color: string,
  symbol: string,
  size: number
};

export type Overlay = {
  vcLine: VCLine,
  info: OverlayInfo
};
