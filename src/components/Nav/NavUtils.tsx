import { NodeType, NodeParamsType, GraphType } from '../../types/Graph';
import { Layout, EdgeLabelMode } from '../../types/GraphFilter';
import { DurationInSeconds, PollIntervalInMs } from '../../types/Common';
import Namespace from '../../types/Namespace';
import { URLParams } from '../../app/History';
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
};

const buildCommonQueryParams = (params: GraphUrlParams): string => {
  let q = `&${URLParams.GRAPH_EDGES}=${params.edgeLabelMode}`;
  q += `&${URLParams.GRAPH_LAYOUT}=${params.graphLayout.name}`;
  q += `&${URLParams.GRAPH_SERVICE_NODES}=${params.showServiceNodes}`;
  q += `&${URLParams.GRAPH_TYPE}=${params.graphType}`;
  q += `&${URLParams.DURATION}=${params.duration}`;
  q += `&${URLParams.POLL_INTERVAL}=${params.refreshInterval}`;
  return q;
};

export const makeNamespacesGraphUrlFromParams = (params: GraphUrlParams): string => {
  let queryParams = buildCommonQueryParams(params);
  if (params.activeNamespaces.length > 0) {
    const namespaces = params.activeNamespaces.map(namespace => namespace.name).join(',');
    queryParams += `&${URLParams.NAMESPACES}=${namespaces}`;
  }
  if (isKioskMode()) {
    queryParams += '&kiosk=true';
  }
  return `/graph/namespaces?` + queryParams;
};

export const makeNodeGraphUrlFromParams = (params: GraphUrlParams): string | undefined => {
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
    return undefined;
  }
};
