export type AppenderString = string;

export type UserName = string;
export type Password = string;
export type RawDate = string;

export enum HTTP_VERBS {
  DELETE = 'DELETE',
  GET = 'get',
  PATCH = 'patch',
  POST = 'post',
  PUT = 'put'
}

export const MILLISECONDS = 1000;

export const UNIT_TIME = {
  SECOND: 1,
  MINUTE: 60,
  HOUR: 3600,
  DAY: 24 * 3600
};

export type TimeInMilliseconds = number;
export type TimeInSeconds = number;

export type IntervalInMilliseconds = number;
export type DurationInSeconds = number;

export type ReplayWindow = {
  interval: IntervalInMilliseconds;
  startTime: TimeInMilliseconds;
};

export type BoundsInMilliseconds = {
  from: TimeInMilliseconds;
  to?: TimeInMilliseconds;
};

export type TimeRange = DurationInSeconds | BoundsInMilliseconds;
// Type-guarding TimeRange: executes first callback when range is a duration, or second callback when it's a bounded range, mapping to a value
export function guardTimeRange<T>(
  range: TimeRange,
  ifDuration: (d: DurationInSeconds) => T,
  ifBounded: (b: BoundsInMilliseconds) => T
): T {
  if ((range as BoundsInMilliseconds).from) {
    return ifBounded(range as BoundsInMilliseconds);
  } else {
    return ifDuration(range as DurationInSeconds);
  }
}

export const evalTimeRange = (range: TimeRange): [Date, Date] => {
  const bounds = guardTimeRange(range, durationToBounds, b => b);
  return [new Date(bounds.from), bounds.to ? new Date(bounds.to) : new Date()];
};

export const boundsToDuration = (bounds: BoundsInMilliseconds): DurationInSeconds => {
  return Math.floor(((bounds.to || new Date().getTime()) - bounds.from) / 1000);
};

export const durationToBounds = (duration: DurationInSeconds): BoundsInMilliseconds => {
  return {
    from: new Date().getTime() - duration * 1000
  };
};
