import type { JaegerTrace } from '../../../types/TracingInfo';
import { format12HourClockTime, formatFromNow, formatRelativeDate } from 'utils/DateTimeUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { formatDuration, isErrorTag } from 'utils/tracing/TracingHelper';

export const shortIDStyle = kialiStyle({
  color: PFColors.Color200,
  padding: 4,
  fontSize: 12
});

export const fullIDStyle = kialiStyle({
  color: PFColors.Color200,
  paddingLeft: 10,
  fontSize: 14
});

export class FormattedTraceInfo {
  public numErrors: number;
  private readonly traceStart: Date;

  constructor(private trace: JaegerTrace) {
    this.traceStart = new Date(trace.startTime / 1000);
    this.numErrors = this.trace.spans.filter(sp => sp.tags.some(isErrorTag)).length;
  }

  name(): string {
    return this.trace.traceName ? this.trace.traceName : '(Missing root span)';
  }

  fullID(): string {
    return this.trace.traceID;
  }

  shortID(): string {
    return this.trace.traceID.slice(0, 6);
  }

  duration(): string {
    return formatDuration(this.trace.duration);
  }

  hasErrors(): boolean {
    return this.numErrors !== 0;
  }

  relativeDate(): string {
    return formatRelativeDate(this.trace.startTime / 1000);
  }

  absTime(): string {
    return format12HourClockTime(this.traceStart);
  }

  fromNow(): string {
    return formatFromNow(this.traceStart);
  }
}
