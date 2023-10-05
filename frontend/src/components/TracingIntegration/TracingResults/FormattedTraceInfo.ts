import { JaegerTrace } from '../../../types/TracingInfo';
import moment from 'moment';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { formatDuration, formatRelativeDate, isErrorTag } from 'utils/tracing/TracingHelper';

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
  private mDate: moment.Moment;
  public numErrors: number;

  constructor(private trace: JaegerTrace) {
    this.mDate = moment(trace.startTime / 1000);
    this.numErrors = this.trace.spans.filter(sp => sp.tags.some(isErrorTag)).length;
  }

  name() {
    return this.trace.traceName ? this.trace.traceName : '(Missing root span)';
  }

  fullID() {
    return this.trace.traceID;
  }

  shortID() {
    return this.trace.traceID.slice(0, 6);
  }

  duration() {
    return formatDuration(this.trace.duration);
  }

  hasErrors() {
    return this.numErrors !== 0;
  }

  relativeDate() {
    return formatRelativeDate(this.trace.startTime / 1000);
  }

  absTime() {
    const timeStr = this.mDate.format('h:mm:ss a');
    return timeStr.slice(0, -3) + ' ' + timeStr.slice(-2);
  }

  fromNow() {
    return this.mDate.fromNow();
  }
}
