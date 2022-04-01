import { JaegerTrace } from '../../../types/JaegerInfo';
import moment from 'moment';
import { style } from 'typestyle';
import { PFColors } from 'components/Pf/PfColors';
import { formatDuration, formatRelativeDate, isErrorTag } from 'utils/tracing/TracingHelper';

export const shortIDStyle = style({
  color: PFColors.Black600,
  padding: 4,
  fontSize: 12
});

export const fullIDStyle = style({
  color: PFColors.Black600,
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
