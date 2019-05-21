import { NodeType, NodeParamsType, GraphType } from '../../types/Graph';
import { Layout, EdgeLabelMode } from '../../types/GraphFilter';
import { DurationInSeconds, PollIntervalInMs } from '../../types/Common';
import Namespace from '../../types/Namespace';
import { URLParam } from '../../app/History';
import { isKioskMode } from '../../utils/SearchParamUtils';

export type GraphUrlParams = {
  activeNamespaces: Namespace[];
  duration: DurationInSeconds;
  edgeLabelMode: EdgeLabelMode;
  graphLayout: Layout;
  graphType: GraphType;
  node?: NodeParamsType;
  refreshInterval: PollIntervalInMs;
  showServiceNodes: boolean;
  showUnusedNodes: boolean;
};

const buildCommonQueryParams = (params: GraphUrlParams): string => {
  let q = `&${URLParam.GRAPH_EDGES}=${params.edgeLabelMode}`;
  q += `&${URLParam.GRAPH_LAYOUT}=${params.graphLayout.name}`;
  q += `&${URLParam.GRAPH_SERVICE_NODES}=${params.showServiceNodes}`;
  q += `&${URLParam.GRAPH_TYPE}=${params.graphType}`;
  q += `&${URLParam.DURATION}=${params.duration}`;
  q += `&${URLParam.POLL_INTERVAL}=${params.refreshInterval}`;
  q += `&${URLParam.UNUSED_NODES}=${params.showUnusedNodes}`;
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
      case NodeType.WORKLOAD:
        return (
          `/graph/node/namespaces/${node.namespace.name}/workloads/${node.workload}?` + buildCommonQueryParams(params)
        );
      case NodeType.SERVICE:
        return (
          `/graph/node/namespaces/${node.namespace.name}/services/${node.service}?` + buildCommonQueryParams(params)
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
