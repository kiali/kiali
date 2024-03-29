import * as GraphData from '../__mockData__/getGraphElements';
import * as ServiceData from '../__mockData__/getServiceDetail';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { GraphElementsQuery } from 'types/Graph';

export const getGraphElements = (params: GraphElementsQuery) => {
  if (GraphData.hasOwnProperty(params.namespaces!)) {
    return Promise.resolve({ data: GraphData[params.namespaces!] });
  } else {
    return Promise.resolve({ data: {} });
  }
};

export const getServiceDetail = (_namespace: string, _service: string): Promise<ServiceDetailsInfo> => {
  return Promise.resolve(ServiceData.SERVICE_DETAILS);
};
