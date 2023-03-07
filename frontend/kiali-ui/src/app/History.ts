import { createBrowserHistory, createMemoryHistory, createHashHistory } from 'history';
import { toValidDuration } from '../config/ServerConfig';
import { BoundsInMilliseconds } from 'types/Common';

const webRoot = (window as any).WEB_ROOT ? (window as any).WEB_ROOT : undefined;
const baseName = webRoot && webRoot !== '/' ? webRoot + '/console' : '/console';
const historyMode = (window as any).HISTORY_MODE ? (window as any).HISTORY_MODE : 'browser';
const history = process.env.TEST_RUNNER
  ? createMemoryHistory()
  : historyMode === 'hash'
  ? createHashHistory()
  : createBrowserHistory({ basename: baseName });

export default history;

export enum URLParam {
  AGGREGATOR = 'aggregator',
  BY_LABELS = 'bylbl',
  DIRECTION = 'direction',
  DISPLAY_MODE = 'displayMode',
  DURATION = 'duration',
  FOCUS_SELECTOR = 'focusSelector',
  FROM = 'from',
  GRAPH_ANIMATION = 'animation',
  GRAPH_BADGE_SECURITY = 'badgeSecurity',
  GRAPH_BADGE_SIDECAR = 'badgeSidecar',
  GRAPH_BADGE_VS = 'badgeVS',
  GRAPH_BOX_CLUSTER = 'boxCluster',
  GRAPH_BOX_NAMESPACE = 'boxNamespace',
  GRAPH_COMPRESS_ON_HIDE = 'graphCompressOnHide',
  GRAPH_EDGE_LABEL = 'edges',
  GRAPH_EDGE_MODE = 'edgeMode',
  GRAPH_FIND = 'graphFind',
  GRAPH_HIDE = 'graphHide',
  GRAPH_IDLE_EDGES = 'idleEdges',
  GRAPH_IDLE_NODES = 'idleNodes',
  GRAPH_LAYOUT = 'layout',
  GRAPH_NAMESPACE_LAYOUT = 'namespaceLayout',
  GRAPH_OPERATION_NODES = 'operationNodes',
  GRAPH_RANK = 'rank',
  GRAPH_RANK_BY = 'rankBy',
  GRAPH_REPLAY_ACTIVE = 'replayActive',
  GRAPH_REPLAY_INTERVAL = 'replayInterval',
  GRAPH_REPLAY_START = 'replayStart',
  GRAPH_SERVICE_NODES = 'injectServiceNodes',
  GRAPH_TRAFFIC = 'traffic',
  GRAPH_TYPE = 'graphType',
  JAEGER_ERRORS_ONLY = 'errs',
  JAEGER_LIMIT_TRACES = 'limit',
  JAEGER_PERCENTILE = 'percentile',
  JAEGER_SHOW_SPANS_AVG = 'showSpansAvg',
  JAEGER_TRACE_ID = 'traceId',
  JAEGER_SPAN_ID = 'spanId',
  NAMESPACES = 'namespaces',
  OVERVIEW_TYPE = 'otype',
  DIRECTION_TYPE = 'drtype',
  QUANTILES = 'quantiles',
  RANGE_DURATION = 'rangeDuration',
  REFRESH_INTERVAL = 'refresh',
  REPORTER = 'reporter',
  SHOW_AVERAGE = 'avg',
  SHOW_SPANS = 'spans',
  SHOW_TRENDLINES = 'trendlines',
  SORT = 'sort',
  TO = 'to',
  EXPERIMENTAL_FLAGS = 'xflags'
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
    const duration = HistoryManager.getNumericParam(URLParam.DURATION, urlParams);
    if (duration) {
      return toValidDuration(Number(duration));
    }
    return undefined;
  };

  static getRangeDuration = (urlParams?: URLSearchParams): number | undefined => {
    const rangeDuration = HistoryManager.getNumericParam(URLParam.RANGE_DURATION, urlParams);
    if (rangeDuration) {
      return toValidDuration(Number(rangeDuration));
    }
    return undefined;
  };

  static getTimeBounds = (urlParams?: URLSearchParams): BoundsInMilliseconds | undefined => {
    const from = HistoryManager.getNumericParam(URLParam.FROM, urlParams);
    if (from) {
      const to = HistoryManager.getNumericParam(URLParam.TO, urlParams);
      // "to" can be undefined (stands for "now")
      return {
        from: from,
        to: to
      };
    }
    return undefined;
  };
}
