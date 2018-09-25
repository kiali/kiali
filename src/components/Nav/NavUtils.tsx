import { GraphParamsType, NodeParamsType, NodeType } from '../../types/Graph';

const buildCommonQueryParams = (params: GraphParamsType): string => {
  let q = `layout=${params.graphLayout.name}`;
  q += `&duration=${params.graphDuration.value}`;
  q += `&edges=${params.edgeLabelMode}`;
  q += `&graphType=${params.graphType}`;
  q += `&injectServiceNodes=${params.injectServiceNodes}`;
  return q;
};

export const makeNamespaceGraphUrlFromParams = (params: GraphParamsType) => {
  return `/graph/namespaces/${params.namespace.name}?` + buildCommonQueryParams(params);
};

export const makeNodeGraphUrlFromParams = (node: NodeParamsType, params: GraphParamsType) => {
  switch (node.nodeType) {
    case NodeType.APP:
      if (node.version && node.version !== 'unknown') {
        return (
          `/graph/namespaces/${params.namespace.name}/applications/${node.app}/versions/${node.version}?` +
          buildCommonQueryParams(params)
        );
      }
      return `/graph/namespaces/${params.namespace.name}/applications/${node.app}?` + buildCommonQueryParams(params);
    case NodeType.WORKLOAD:
      return `/graph/namespaces/${params.namespace.name}/workloads/${node.workload}?` + buildCommonQueryParams(params);
    default:
      console.debug('makeNodeUrl defaulting to makeNamespaceUrl');
      return makeNamespaceGraphUrlFromParams(params);
  }
};
