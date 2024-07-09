import { toValidDuration } from '../config/ServerConfig';
import { BoundsInMilliseconds } from 'types/Common';
import { RouteObject, createBrowserRouter, createHashRouter, createMemoryRouter } from 'react-router-dom-v5-compat';

export const createRouter = (routes: RouteObject[], baseName: string): any => {
  return process.env.TEST_RUNNER
    ? createMemoryRouter(routes, { basename: baseName })
    : historyMode === 'hash'
    ? createHashRouter(routes, { basename: baseName })
    : createBrowserRouter(routes, { basename: baseName });
};

const webRoot = (window as any).WEB_ROOT ? (window as any).WEB_ROOT : undefined;
const rootBaseName = webRoot && webRoot !== '/' ? `${webRoot}/console` : '/console';
const historyMode = (window as any).HISTORY_MODE ? (window as any).HISTORY_MODE : 'browser';

/**
 * Some platforms set a different basename for each page (e.g., Openshift Console)
 * A setHistory method is defined to be able to modify the history basename when user
 * routes to a different page within Kiali in these platforms.
 * This method is not used in standalone Kiali application
 */
export const setRouter = (routes: RouteObject[], baseName?: string): void => {
  router = createRouter(routes, baseName ?? rootBaseName);
};

let router = createRouter([{ element: <></> }], rootBaseName);

const location = {
  getPathname: (): string => {
    return router.state.location.pathname.replace(router.basename, '');
  },

  getSearch: (): string => {
    return router.state.location.search;
  }
};

export { router, location };

export enum URLParam {
  AGGREGATOR = 'aggregator',
  BY_LABELS = 'bylbl',
  CLUSTERNAME = 'clusterName',
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
  GRAPH_WAYPOINTS = 'waypoints',
  MESH_FIND = 'meshFind',
  MESH_HIDE = 'meshHide',
  MESH_LAYOUT = 'meshLayout',
  TRACING_ERRORS_ONLY = 'errs',
  TRACING_LIMIT_TRACES = 'limit',
  TRACING_PERCENTILE = 'percentile',
  TRACING_SHOW_SPANS_AVG = 'showSpansAvg',
  TRACING_TRACE_ID = 'traceId',
  TRACING_SPAN_ID = 'spanId',
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
  SHOW_ZTUNNEL = 'ztunnel',
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
  static setParam = (name: URLParam | string, value: string): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.set(name, value);

    router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });
  };

  static getParam = (name: URLParam | string, urlParams?: URLSearchParams): string | undefined => {
    if (!urlParams) {
      urlParams = new URLSearchParams(location.getSearch());
    }

    const p = urlParams.get(name);
    return p !== null ? p : undefined;
  };

  static getNumericParam = (name: URLParam, urlParams?: URLSearchParams): number | undefined => {
    const p = HistoryManager.getParam(name, urlParams);
    return p !== undefined ? Number(p) : undefined;
  };

  static getBooleanParam = (name: URLParam | string, urlParams?: URLSearchParams): boolean | undefined => {
    const p = HistoryManager.getParam(name, urlParams);
    return p !== undefined ? p === 'true' : undefined;
  };

  static deleteParam = (name: URLParam, historyReplace?: boolean): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.delete(name);

    if (historyReplace) {
      router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });
    } else {
      router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
    }
  };

  static setParams = (params: URLParamValue[], paramAction?: ParamAction, historyReplace?: boolean): void => {
    const urlParams = new URLSearchParams(location.getSearch());

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
      router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });
    } else {
      router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
    }
  };

  static getClusterName = (urlParams?: URLSearchParams): string | undefined => {
    if (!urlParams) {
      urlParams = new URLSearchParams(location.getSearch());
    }

    return urlParams.get(URLParam.CLUSTERNAME) || undefined;
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
