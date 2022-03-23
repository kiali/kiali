import { VCLine, LineInfo, VCDataPoint } from './VictoryChartInfo';

export type OverlayInfo<T extends LineInfo> = {
  lineInfo: T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataStyle: any; // see "data" in https://formidable.com/open-source/victory/docs/common-props/#style
  buckets?: number;
};

export type Overlay<T extends LineInfo> = {
  vcLine: VCLine<VCDataPoint & T>;
  info: OverlayInfo<T>;
};
