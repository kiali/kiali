import { GraphParamsType } from '../../types/Graph';
import { baseName } from '../../routes';

export const makeServiceGraphUrlFromParams = (params: GraphParamsType) =>
  `${baseName}/service-graph/${params.namespace.name}?layout=${params.graphLayout.name}&duration=${
    params.graphDuration.value
  }&edges=${params.edgeLabelMode}`;
