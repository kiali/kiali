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
