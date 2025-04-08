import { defaultMetricsDuration } from '../components/Metrics/Helper';

export type AppenderString = string;

export type UserName = string;
export type Password = string;
export type RawDate = string;

export type KioskMode = string;

export enum HTTP_VERBS {
  DELETE = 'DELETE',
  GET = 'get',
  PATCH = 'patch',
  POST = 'post',
  PUT = 'put'
}

export const PF_THEME_DARK = 'pf-v5-theme-dark';
export const KIALI_THEME = 'KIALI_THEME';

export const enum Theme {
  DARK = 'Dark',
  LIGHT = 'Light'
}

export const enum Language {
  CHINESE = 'zh',
  ENGLISH = 'en',
  SPANISH = 'es'
}

export type TargetKind = 'app' | 'service' | 'workload';

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

export type BoundsInMilliseconds = {
  from?: TimeInMilliseconds;
  to?: TimeInMilliseconds;
};

// Redux doesn't work well with type composition
export type TimeRange = {
  from?: TimeInMilliseconds;
  rangeDuration?: DurationInSeconds;
  to?: TimeInMilliseconds;
};

// Type-guarding TimeRange: executes first callback when range is a duration, or second callback when it's a bounded range, mapping to a value
export const guardTimeRange = <T>(
  range: TimeRange,
  ifDuration: (d: DurationInSeconds) => T,
  ifBounded: (b: BoundsInMilliseconds) => T
): T => {
  if (range.from) {
    const b: BoundsInMilliseconds = {
      from: range.from
    };

    if (range.to) {
      b.to = range.to;
    }

    return ifBounded(b);
  } else {
    if (range.rangeDuration) {
      return ifDuration(range.rangeDuration);
    }
  }

  // It shouldn't reach here a TimeRange should have DurationInSeconds or BoundsInMilliseconds
  return ifDuration(defaultMetricsDuration);
};

export const evalTimeRange = (range: TimeRange): [Date, Date] => {
  const bounds = guardTimeRange(range, durationToBounds, b => b);
  return [bounds.from ? new Date(bounds.from) : new Date(), bounds.to ? new Date(bounds.to) : new Date()];
};

export const boundsToDuration = (bounds: BoundsInMilliseconds): DurationInSeconds => {
  return Math.floor(((bounds.to || new Date().getTime()) - (bounds.from || new Date().getTime())) / 1000);
};

export const durationToBounds = (duration: DurationInSeconds): BoundsInMilliseconds => {
  return {
    from: new Date().getTime() - duration * 1000
  };
};

export const isEqualTimeRange = (t1: TimeRange, t2: TimeRange): boolean => {
  if (
    (!t1 && t2) ||
    (t1 && !t2) ||
    t1?.from !== t2?.from ||
    t1?.to !== t2?.to ||
    t1?.rangeDuration !== t2?.rangeDuration
  ) {
    return false;
  }

  return true;
};

// InstanceType is either an App, Workload, or Service. It represents one of the three
// different pages that Kiali shows lists for other than Istio config.
export enum InstanceType {
  App = 'app',
  Service = 'service',
  Workload = 'workload'
}
