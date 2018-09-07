import { GraphParamsType, NodeParamsType, NodeType } from '../../types/Graph';

export const makeNamespaceGraphUrlFromParams = (params: GraphParamsType) => {
  return `/graph/namespaces/${params.namespace.name}?layout=${params.graphLayout.name}&duration=${
    params.graphDuration.value
  }&edges=${params.edgeLabelMode}&graphType=${params.graphType}&injectServiceNodes=${params.injectServiceNodes}`;
};

export const makeNodeGraphUrlFromParams = (node: NodeParamsType, params: GraphParamsType) => {
  params.injectServiceNodes = true; // TODO: Remove this when injectServiceNodes is an on-screen option
  switch (node.nodeType) {
    case NodeType.APP:
      if (node.version && node.version !== 'unknown') {
        return `/graph/namespaces/${params.namespace.name}/applications/${node.app}/versions/${node.version}?layout=${
          params.graphLayout.name
        }&duration=${params.graphDuration.value}&edges=${params.edgeLabelMode}&graphType=${
          params.graphType
        }&injectServiceNodes=${params.injectServiceNodes}`;
      }
      return `/graph/namespaces/${params.namespace.name}/applications/${node.app}?layout=${
        params.graphLayout.name
      }&duration=${params.graphDuration.value}&edges=${params.edgeLabelMode}&graphType=${
        params.graphType
      }&injectServiceNodes=${params.injectServiceNodes}`;
    case NodeType.WORKLOAD:
      return `/graph/namespaces/${params.namespace.name}/workloads/${node.workload}?layout=${
        params.graphLayout.name
      }&duration=${params.graphDuration.value}&edges=${params.edgeLabelMode}&graphType=${
        params.graphType
      }&injectServiceNodes=${params.injectServiceNodes}`;
    default:
      console.log('makeNodeUrl defaulting to makeNamespaceUrl');
      return makeNamespaceGraphUrlFromParams(params);
  }
};
