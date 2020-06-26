import { VCLine, toVCLine, toVCDatapoints, VCLines, RichDataPoint } from '@kiali/k-charted-pf4';
import { TimeSeries, Datapoint } from '../types/Metrics';

export default {
  toVCLine(dps: Datapoint[], name: string, color: string): VCLine<RichDataPoint> {
    return toVCLine(toVCDatapoints(dps, name), { name: name, color: color });
  },

  toVCLines(ts: TimeSeries[], colors: string[], title?: string): VCLines<RichDataPoint> {
    return ts.map((line, idx) => {
      const name = title || line.name || '';
      const color = colors[idx % colors.length];
      return this.toVCLine(line.values, name, color);
    });
  }
};
