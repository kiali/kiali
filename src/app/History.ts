import { createBrowserHistory, createMemoryHistory } from 'history';
import { toValidDuration } from '../config/ServerConfig';

const webRoot = (window as any).WEB_ROOT ? (window as any).WEB_ROOT : undefined;
const baseName = webRoot && webRoot !== '/' ? webRoot + '/console' : '/console';
const history = process.env.TEST_RUNNER ? createMemoryHistory() : createBrowserHistory({ basename: baseName });

export default history;

export enum URLParam {
  AGGREGATOR = 'aggregator',
  BY_LABELS = 'bylbl',
  DIRECTION = 'direction',
  DURATION = 'duration',
  GRAPH_EDGES = 'edges',
  GRAPH_LAYOUT = 'layout',
  GRAPH_SERVICE_NODES = 'injectServiceNodes',
  GRAPH_TYPE = 'graphType',
  NAMESPACES = 'namespaces',
  OVERVIEW_TYPE = 'otype',
  PAGE = 'page',
  PER_PAGE = 'perPage',
  POLL_INTERVAL = 'pi',
  QUANTILES = 'quantiles',
  REPORTER = 'reporter',
  SHOW_AVERAGE = 'avg',
  SORT = 'sort',
  UNUSED_NODES = 'unusedNodes',
  JAEGER_START_TIME = 'start',
  JAEGER_END_TIME = 'end',
  JAEGER_LIMIT_TRACES = 'limit',
  JAEGER_LOOKBACK = 'lookback',
  JAEGER_MAX_DURATION = 'maxDuration',
  JAEGER_MIN_DURATION = 'minDuration',
  JAEGER_SERVICE_SELECTOR = 'service',
  JAEGER_TAGS = 'tags'
}

export interface URLParamValue {
  name: URLParam;
  value: any;
}

export enum ParamAction {
  APPEND,
  SET
}

export class HistoryManager {
  static setParam = (name: URLParam, value: string) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(name, value);
    history.replace(history.location.pathname + '?' + urlParams.toString());
  };

  static getParam = (name: URLParam, urlParams?: URLSearchParams): string | undefined => {
    if (!urlParams) {
      urlParams = new URLSearchParams(history.location.search);
    }
    const p = urlParams.get(name);
    return p !== null ? p : undefined;
  };

  static getNumericParam = (name: URLParam, urlParams?: URLSearchParams): number | undefined => {
    const p = HistoryManager.getParam(name, urlParams);
    return p !== undefined ? Number(p) : undefined;
  };

  static getBooleanParam = (name: URLParam, urlParams?: URLSearchParams): boolean | undefined => {
    const p = HistoryManager.getParam(name, urlParams);
    return p !== undefined ? p === 'true' : undefined;
  };

  static deleteParam = (name: URLParam, historyReplace?: boolean) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.delete(name);
    if (historyReplace) {
      history.replace(history.location.pathname + '?' + urlParams.toString());
    } else {
      history.push(history.location.pathname + '?' + urlParams.toString());
    }
  };

  static setParams = (params: URLParamValue[], paramAction?: ParamAction, historyReplace?: boolean) => {
    const urlParams = new URLSearchParams(history.location.search);

    if (params.length > 0 && paramAction === ParamAction.APPEND) {
      params.forEach(param => urlParams.delete(param.name));
    }

    params.forEach(param => {
      if (param.value === '') {
        urlParams.delete(param.name);
      } else if (paramAction === ParamAction.APPEND) {
        urlParams.append(param.name, param.value);
      } else {
        urlParams.set(param.name, param.value);
      }
    });

    if (historyReplace) {
      history.replace(history.location.pathname + '?' + urlParams.toString());
    } else {
      history.push(history.location.pathname + '?' + urlParams.toString());
    }
  };

  static getDuration = (urlParams?: URLSearchParams): number | undefined => {
    const duration = HistoryManager.getParam(URLParam.DURATION, urlParams);
    if (duration) {
      return toValidDuration(Number(duration));
    }
    return undefined;
  };
}
