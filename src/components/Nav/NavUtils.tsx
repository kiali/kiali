import { Layout, EdgeLabelMode, NodeType, NodeParamsType, GraphType, TrafficRate } from '../../types/Graph';
import { DurationInSeconds, IntervalInMilliseconds } from '../../types/Common';
import Namespace from '../../types/Namespace';
import { URLParam } from '../../app/History';
import { isKioskMode } from '../../utils/SearchParamUtils';

export type GraphUrlParams = {
  activeNamespaces: Namespace[];
  duration: DurationInSeconds;
  edgeLabels: EdgeLabelMode[];
  graphLayout: Layout;
  graphType: GraphType;
  node?: NodeParamsType;
  refreshInterval: IntervalInMilliseconds;
  showIdleEdges: boolean;
  showIdleNodes: boolean;
  showOperationNodes: boolean;
  showServiceNodes: boolean;
  trafficRates: TrafficRate[];
};

const buildCommonQueryParams = (params: GraphUrlParams): string => {
  let q = `&${URLParam.GRAPH_EDGE_LABEL}=${params.edgeLabels}`;
  q += `&${URLParam.GRAPH_LAYOUT}=${params.graphLayout.name}`;
  q += `&${URLParam.GRAPH_IDLE_EDGES}=${params.showIdleEdges}`;
  q += `&${URLParam.GRAPH_IDLE_NODES}=${params.showIdleNodes}`;
  q += `&${URLParam.GRAPH_SERVICE_NODES}=${params.showServiceNodes}`;
  q += `&${URLParam.GRAPH_TRAFFIC}=${params.trafficRates}`;
  q += `&${URLParam.GRAPH_TYPE}=${params.graphType}`;
  q += `&${URLParam.DURATION}=${params.duration}`;
  q += `&${URLParam.GRAPH_OPERATION_NODES}=${params.showOperationNodes}`;
  q += `&${URLParam.REFRESH_INTERVAL}=${params.refreshInterval}`;
  return q;
};

export const makeNamespacesGraphUrlFromParams = (params: GraphUrlParams): string => {
  let queryParams = buildCommonQueryParams(params);
  if (params.activeNamespaces.length > 0) {
    const namespaces = params.activeNamespaces.map(namespace => namespace.name).join(',');
    queryParams += `&${URLParam.NAMESPACES}=${namespaces}`;
  }
  if (isKioskMode()) {
    queryParams += '&kiosk=true';
  }
  return `/graph/namespaces?` + queryParams;
};

export const makeNodeGraphUrlFromParams = (params: GraphUrlParams): string => {
  const node = params.node;
  if (node) {
    switch (node.nodeType) {
      case NodeType.AGGREGATE:
        return (
          `/graph/node/namespaces/${node.namespace.name}/aggregates/${node.aggregate}/${node.aggregateValue}?` +
          buildCommonQueryParams(params)
        );
      case NodeType.APP:
        if (node.version && node.version !== 'unknown') {
          return (
            `/graph/node/namespaces/${node.namespace.name}/applications/${node.app}/versions/${node.version}?` +
            buildCommonQueryParams(params)
          );
        }
        return (
          `/graph/node/namespaces/${node.namespace.name}/applications/${node.app}?` + buildCommonQueryParams(params)
        );
      case NodeType.BOX:
        // can only be app box
        return (
          `/graph/node/namespaces/${node.namespace.name}/applications/${node.app}?` + buildCommonQueryParams(params)
        );
      case NodeType.SERVICE:
        return (
          `/graph/node/namespaces/${node.namespace.name}/services/${node.service}?` + buildCommonQueryParams(params)
        );
      case NodeType.WORKLOAD:
        return (
          `/graph/node/namespaces/${node.namespace.name}/workloads/${node.workload}?` + buildCommonQueryParams(params)
        );
      default:
        console.debug('makeNodeUrl defaulting to makeNamespaceUrl');
        return makeNamespacesGraphUrlFromParams(params);
    }
  } else {
    // this should never happen but typescript needs this
    return '';
  }
};
