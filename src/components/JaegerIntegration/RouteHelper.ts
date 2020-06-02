import logfmtParser from 'logfmt/lib/logfmt_parser';
import { KeyValuePair } from '../../types/JaegerInfo';
import { retrieveTimeRange } from 'components/Time/TimeRangeHelper';
import { guardTimeRange, durationToBounds } from 'types/Common';

export const buildTags = (showErrors: boolean, statusCode: string): string => {
  let tags = '';
  if (showErrors) {
    tags += 'error=true';
  }
  if (statusCode !== 'none') {
    tags += ' http.status_code=' + statusCode;
  }
  return convTagsLogfmt(tags);
};

export const isErrorTag = ({ key, value }: KeyValuePair) => key === 'error' && (value === true || value === 'true');

const convTagsLogfmt = (tags: string) => {
  if (!tags) {
    return '';
  }
  const data = logfmtParser.parse(tags);
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (typeof value !== 'string') {
      data[key] = String(value);
    }
  });
  return JSON.stringify(data);
};

export const getTimeRangeMicros = () => {
  const range = retrieveTimeRange() || 600;
  // Convert any time range (like duration) to bounded from/to
  const boundsMillis = guardTimeRange(range, durationToBounds, b => b);
  // Convert to microseconds
  return {
    from: boundsMillis.from * 1000,
    to: boundsMillis.to ? boundsMillis.to * 1000 : undefined
  };
};
