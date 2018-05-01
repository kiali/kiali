import serviceGraphState from '../ServiceGraphState';
import { ServiceGraphActionsType } from '../../actions/ServiceGraphActions';

describe('ServiceGraphState reducer', () => {
  it('should return the initial state', () => {
    expect(serviceGraphState(undefined, {})).toEqual({
      showNodeLabels: true,
      showEdgeLabels: false
    });
  });

  it('should handle TOGGLE_GRAPH_NODE_LABEL', () => {
    expect(
      serviceGraphState(
        {
          showNodeLabels: true,
          showEdgeLabels: true
        },
        {
          type: ServiceGraphActionsType.TOGGLE_GRAPH_NODE_LABEL
        }
      )
    ).toEqual({
      showNodeLabels: false,
      showEdgeLabels: true
    });
  });

  it('should handle TOGGLE_GRAPH_EDGE_LABEL', () => {
    expect(
      serviceGraphState(
        {
          showNodeLabels: true,
          showEdgeLabels: true
        },
        {
          type: ServiceGraphActionsType.TOGGLE_GRAPH_EDGE_LABEL
        }
      )
    ).toEqual({
      showNodeLabels: true,
      showEdgeLabels: false
    });
  });
});
