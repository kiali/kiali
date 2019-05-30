import { jaegerQuery } from '../../config';
import logfmtParser from 'logfmt/lib/logfmt_parser';
import moment from 'moment';
import { HistoryManager, URLParam } from '../../app/History';

export interface JaegerSearchOptions {
  serviceSelected: string;
  limit: number;
  start: string;
  end: string;
  minDuration: string;
  maxDuration: string;
  lookback: string;
  tags: string;
}

interface DateTime {
  date: string;
  time: string;
}

export interface TracesDate {
  start: DateTime;
  end: DateTime;
}

const converToTimestamp = (lookback: string): number => {
  const multiplier = 1000 * 1000;
  return Number(lookback) * multiplier;
};

const convTagsLogfmt = (tags: string) => {
  if (!tags) {
    return null;
  }
  const data = logfmtParser.parse(tags);
  Object.keys(data).forEach(key => {
    const value = data[key];
    // make sure all values are strings
    // https://github.com/jaegertracing/jaeger/issues/550#issuecomment-352850811
    if (typeof value !== 'string') {
      data[key] = String(value);
    }
  });
  return JSON.stringify(data);
};

export const logfmtTagsConv = (tags: string | undefined) => {
  if (!tags) {
    return null;
  }
  let resultTags = '';
  const jsonTags = JSON.parse(tags);
  Object.keys(jsonTags).forEach(key => {
    resultTags += `${key}=${String(jsonTags[key])} `;
  });
  return resultTags;
};

export const getUnixTimeStampInMSFromForm = (
  startDate: string,
  startDateTime: string,
  endDate: string,
  endDateTime: string
) => {
  const start = `${startDate} ${startDateTime}`;
  const end = `${endDate} ${endDateTime}`;
  return {
    start: `${moment(start, 'YYYY-MM-DD HH:mm')
      .utc()
      .valueOf()}000`,
    end: `${moment(end, 'YYYY-MM-DD HH:mm')
      .utc()
      .valueOf()}000`
  };
};

export const getFormFromUnixTimeStamp = (value: number, extra?: number) => {
  let time = value + (extra ? extra : 0);
  if (value === 0) {
    time = moment.utc().valueOf() + (extra ? extra : 0);
  }

  const dateTime = moment(time)
    .format('YYYY-MM-DD HH:mm')
    .split(' ');

  return {
    date: dateTime[0],
    time: dateTime[1]
  };
};

export class JaegerURLSearch {
  url: string;

  constructor(url: string, embed: boolean = true) {
    if (embed) {
      this.url = `${url}${jaegerQuery().path}?${jaegerQuery().embed.uiEmbed}=${jaegerQuery().embed.version}`;
    } else {
      this.url = `${url}${jaegerQuery().path}/search?`;
    }
  }

  addQueryParam(param: URLParam, value: string | number) {
    this.url += `&${param}=${value}`;
  }

  addParam(param: string) {
    this.url += `&${param}`;
  }

  createRoute(searchOptions: JaegerSearchOptions) {
    const nowTime = Date.now() * 1000;
    const lookback =
      searchOptions.lookback === 'custom' || searchOptions.lookback === '0' ? 'custom' : searchOptions.lookback;
    const endTime = lookback !== 'custom' ? `${nowTime}` : searchOptions.end;
    const startTime = lookback !== 'custom' ? `${nowTime - converToTimestamp(lookback)}` : searchOptions.start;

    // Add query and set data

    this.setParam(URLParam.JAEGER_START_TIME, startTime);
    this.setParam(URLParam.JAEGER_END_TIME, endTime);
    this.setParam(URLParam.JAEGER_LIMIT_TRACES, String(searchOptions.limit));
    this.setParam(URLParam.JAEGER_LOOKBACK, lookback);
    this.setParam(URLParam.JAEGER_MAX_DURATION, searchOptions.maxDuration);
    this.setParam(URLParam.JAEGER_MIN_DURATION, searchOptions.minDuration);
    this.setParam(URLParam.JAEGER_SERVICE_SELECTOR, searchOptions.serviceSelected);

    const logfmtTags = convTagsLogfmt(searchOptions.tags);
    if (logfmtTags) {
      this.setParam(URLParam.JAEGER_TAGS, logfmtTags);
    }

    return this.url;
  }

  private setParam(param: URLParam, value: string) {
    this.addQueryParam(param, value);
    HistoryManager.setParam(param, value);
  }
}
