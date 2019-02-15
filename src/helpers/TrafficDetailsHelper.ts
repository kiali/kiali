import { authentication } from '../utils/Authentication';
import * as MessageCenter from '../utils/MessageCenter';
import * as API from '../services/Api';
import { GraphDefinition, NodeParamsType } from '../types/Graph';

export const fetchTrafficDetails = (
  node: NodeParamsType,
  restParams: any
): Promise<GraphDefinition | undefined | null> => {
  return API.getNodeGraphElements(authentication(), node, restParams).then(
    (response: any) => {
      // Check that response is formed as expected.
      if (!response.data || !response.data.elements || !response.data.elements.nodes || !response.data.elements.edges) {
        MessageCenter.add('Bad traffic data');
        return;
      }

      // Check that there is traffic data.
      if (response.data.elements.nodes.length === 0 || response.data.elements.edges.length === 0) {
        return null;
      }

      return response.data;
    },
    error => {
      MessageCenter.add(API.getErrorMsg('Could not fetch traffic data', error));
      return undefined;
    }
  );
};
