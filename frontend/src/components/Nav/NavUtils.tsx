import { Layout, EdgeLabelMode, NodeType, NodeParamsType, GraphType, TrafficRate, EdgeMode } from '../../types/Graph';
import { DurationInSeconds, IntervalInMilliseconds } from '../../types/Common';
import { Namespace } from '../../types/Namespace';
import { URLParam } from '../../app/History';
import { getKioskMode, isKioskMode } from '../../utils/SearchParamUtils';
import { isMultiCluster } from 'config';

export type GraphUrlParams = {
  activeNamespaces: Namespace[];
  duration: DurationInSeconds;
  edgeLabels: EdgeLabelMode[];
  edgeMode: EdgeMode;
  graphLayout: Layout;
  graphType: GraphType;
  namespaceLayout: Layout;
  node?: NodeParamsType;
  refreshInterval: IntervalInMilliseconds;
  showIdleEdges: boolean;
  showIdleNodes: boolean;
  showOperationNodes: boolean;
  showServiceNodes: boolean;
  showWaypoints: boolean;
  trafficRates: TrafficRate[];
};

const buildCommonQueryParams = (params: GraphUrlParams): string => {
  let q = `&${URLParam.GRAPH_EDGE_LABEL}=${params.edgeLabels}`;
  q += `&${URLParam.GRAPH_EDGE_MODE}=${params.edgeMode}`;
  q += `&${URLParam.GRAPH_LAYOUT}=${params.graphLayout.name}`;
  q += `&${URLParam.GRAPH_NAMESPACE_LAYOUT}=${params.namespaceLayout.name}`;
  q += `&${URLParam.GRAPH_IDLE_EDGES}=${params.showIdleEdges}`;
  q += `&${URLParam.GRAPH_IDLE_NODES}=${params.showIdleNodes}`;
  q += `&${URLParam.GRAPH_SERVICE_NODES}=${params.showServiceNodes}`;
  q += `&${URLParam.GRAPH_TRAFFIC}=${params.trafficRates}`;
  q += `&${URLParam.GRAPH_TYPE}=${params.graphType}`;
  q += `&${URLParam.DURATION}=${params.duration}`;
  q += `&${URLParam.GRAPH_OPERATION_NODES}=${params.showOperationNodes}`;
  q += `&${URLParam.REFRESH_INTERVAL}=${params.refreshInterval}`;

  if (params.node && params.node.cluster && isMultiCluster) {
    q += `&${URLParam.CLUSTERNAME}=${encodeURIComponent(params.node?.cluster)}`;
  }

  return q;
};

export const makeNamespacesGraphUrlFromParams = (params: GraphUrlParams, isPf = false): string => {
  const route = isPf ? 'graphpf' : 'graph';
  let queryParams = buildCommonQueryParams(params);
  if (params.activeNamespaces.length > 0) {
    const namespaces = params.activeNamespaces.map(namespace => namespace.name).join(',');
    queryParams += `&${URLParam.NAMESPACES}=${namespaces}`;
  }
  if (isKioskMode()) {
    // Kiosk value can be true or the url of the parent
    queryParams += `&kiosk=${getKioskMode()}`;
  }
  return `/${route}/namespaces?${queryParams}`;
};

export const makeNodeGraphUrlFromParams = (params: GraphUrlParams, isPf = false): string => {
  const route = isPf ? 'graphpf' : 'graph';
  const node = params.node;

  if (node?.isWaypoint && node?.nodeType === NodeType.APP) {
    // Waypoints are not part of the app, so make a correction to redirect properly
    node.nodeType = NodeType.WORKLOAD;
  }

  if (node) {
    switch (node.nodeType) {
      case NodeType.AGGREGATE:
        return `/${route}/node/namespaces/${node.namespace.name}/aggregates/${node.aggregate}/${
          node.aggregateValue
        }?${buildCommonQueryParams(params)}`;
      case NodeType.APP:
        if (node.version && node.version !== 'unknown') {
          return `/${route}/node/namespaces/${node.namespace.name}/applications/${node.app}/versions/${
            node.version
          }?${buildCommonQueryParams(params)}`;
        }
        return `/${route}/node/namespaces/${node.namespace.name}/applications/${node.app}?${buildCommonQueryParams(
          params
        )}`;
      case NodeType.BOX:
        // can only be app box
        return `/${route}/node/namespaces/${node.namespace.name}/applications/${node.app}?${buildCommonQueryParams(
          params
        )}`;
      case NodeType.SERVICE:
        return `/${route}/node/namespaces/${node.namespace.name}/services/${node.service}?${buildCommonQueryParams(
          params
        )}`;
      case NodeType.WORKLOAD:
        return `/${route}/node/namespaces/${node.namespace.name}/workloads/${node.workload}?${buildCommonQueryParams(
          params
        )}`;
      default:
        console.debug('makeNodeUrl defaulting to makeNamespaceUrl');
        return makeNamespacesGraphUrlFromParams(params, isPf);
    }
  } else {
    // this should never happen but typescript needs this
    return '';
  }
};
