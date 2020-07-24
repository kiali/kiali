import { JaegerTrace } from '../../../types/JaegerInfo';
import moment from 'moment';
import { formatDuration, formatRelativeDate } from './transform';
import { isErrorTag } from '../JaegerHelper';

export type FormattedTraceInfo = {
  name: string;
  spans: string;
  duration?: string;
  errors?: string;
  relativeDate: string;
  absTime: string;
  fromNow: string;
};

export const getFormattedTraceInfo = (trace: JaegerTrace): FormattedTraceInfo => {
  const { traceName, duration, spans, startTime } = trace;
  const numSpans = spans.length;
  const mDate = moment(startTime / 1000);
  const timeStr = mDate.format('h:mm:ss a');
  const numErredSpans = spans.filter(sp => sp.tags.some(isErrorTag)).length;
  return {
    name: traceName ? traceName : '<trace-without-root-span>',
    spans: `${numSpans} Span${numSpans !== 1 ? 's' : ''}`,
    duration: duration ? formatDuration(duration) : undefined,
    errors: numErredSpans > 0 ? `${numErredSpans} Error${numErredSpans !== 1 ? 's' : ''}` : undefined,
    relativeDate: formatRelativeDate(startTime / 1000),
    absTime: timeStr.slice(0, -3) + ' ' + timeStr.slice(-2),
    fromNow: mDate.fromNow()
  };
};
