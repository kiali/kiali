export const KEY_CODES = {
  TAB_KEY: 9,
  ENTER_KEY: 13,
  ESCAPE_KEY: 27
};

export type AppenderString = string;

export type UserName = string;
export type Password = string;
export type RawDate = string;

export const HTTP_CODES = {
  OK: 200,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  REQUEST_FAILED: 422,
  INTERNAL_SERVER: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

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

export type PollIntervalInMs = TimeInMilliseconds;
export type DurationInSeconds = TimeInSeconds;

export type JsonString = string;
