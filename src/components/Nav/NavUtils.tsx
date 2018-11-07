import { GraphParamsType, NodeType } from '../../types/Graph';
import { store } from '../../store/ConfigStore';

const buildCommonQueryParams = (params: GraphParamsType): string => {
  let q = `layout=${params.graphLayout.name}`;
  q += `&duration=${store.getState().userSettings.duration}`;
  q += `&edges=${params.edgeLabelMode}`;
  q += `&graphType=${params.graphType}`;
  q += `&injectServiceNodes=${params.injectServiceNodes}`;
  return q;
};

export const makeNamespaceGraphUrlFromParams = (params: GraphParamsType): string => {
  const namespace = store.getState().namespaces.activeNamespace.name;
  let queryParams = buildCommonQueryParams(params);
  if (namespace !== 'all') {
    queryParams += `&namespaces=${namespace}`;
  }
  return `/graph/namespaces?` + queryParams;
};

export const makeNodeGraphUrlFromParams = (params: GraphParamsType): string | undefined => {
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
        return makeNamespaceGraphUrlFromParams(params);
    }
  } else {
    // this should never happen but typescript needs this
    return undefined;
  }
};
