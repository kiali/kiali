import logfmtParser from 'logfmt/lib/logfmt_parser';
import { HistoryManager, URLParam } from '../../app/History';
import { KeyValuePair } from '../../types/JaegerInfo';
import MetricsDuration from '../MetricsOptions/MetricsDuration';

export interface JaegerSearchOptions {
  limit: string;
  start?: string;
  end?: string;
  lookback?: string;
  tags?: string;
}

export const isErrorTag = ({ key, value }: KeyValuePair) => key === 'error' && (value === true || value === 'true');

export const convTagsLogfmt = (tags: string) => {
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

export const getQueryJaeger = () => {
  let params: any = {
    limit: HistoryManager.getParam(URLParam.JAEGER_LIMIT_TRACES) || '20'
  };

  const optionsQuery = [URLParam.JAEGER_TAGS];
  optionsQuery.forEach(opt => {
    if (HistoryManager.getParam(opt)) {
      params[opt] = HistoryManager.getParam(opt);
    }
  });

  const nowTime = Date.now() * 1000;
  params[URLParam.JAEGER_START_TIME] = nowTime - MetricsDuration.initialDuration() * 1000 * 1000;
  params[URLParam.JAEGER_END_TIME] = nowTime;
  HistoryManager.setParam(URLParam.JAEGER_START_TIME, params[URLParam.JAEGER_START_TIME]);
  HistoryManager.setParam(URLParam.JAEGER_END_TIME, params[URLParam.JAEGER_END_TIME]);
  return params;
};
