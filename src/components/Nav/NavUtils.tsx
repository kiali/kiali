import { GraphParamsType } from '../../types/Graph';

export const makeServiceGraphUrlFromParams = (params: GraphParamsType) =>
  `/service-graph/${params.namespace.name}?layout=${params.graphLayout.name}&duration=${
    params.graphDuration.value
  }&edges=${params.edgeLabelMode}&graphType=${params.graphType}&versioned=${params.versioned}`;
