import serviceGraphFilterState from '../ServiceGraphFilterState';
import { ServiceGraphFilterActionKeys } from '../../actions/ServiceGraphFilterActions';
import { EdgeLabelMode } from '../../types/GraphFilter';

describe('ServiceGraphFilterState reducer', () => {
  it('should return the initial state', () => {
    expect(serviceGraphFilterState(undefined, {})).toEqual({
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.NONE,
      showCircuitBreakers: false,
      showRouteRules: true,
      showMissingSidecars: true
    });
  });

  it('should handle TOGGLE_GRAPH_NODE_LABEL', () => {
    expect(
      serviceGraphFilterState(
        {
          showNodeLabels: true,
          edgeLabelMode: EdgeLabelMode.NONE,
          showCircuitBreakers: false,
          showRouteRules: true,
          showMissingSidecars: true
        },
        {
          type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL
        }
      )
    ).toEqual({
      showNodeLabels: false,
      edgeLabelMode: EdgeLabelMode.NONE,
      showCircuitBreakers: false,
      showRouteRules: true,
      showMissingSidecars: true
    });
  });

  it('should handle TOGGLE_GRAPH_EDGE_LABEL', () => {
    expect(
      serviceGraphFilterState(
        {
          showNodeLabels: true,
          edgeLabelMode: EdgeLabelMode.NONE,
          showCircuitBreakers: false,
          showRouteRules: true,
          showMissingSidecars: true
        },
        {
          type: ServiceGraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
          payload: EdgeLabelMode.LATENCY
        }
      )
    ).toEqual({
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.LATENCY,
      showCircuitBreakers: false,
      showRouteRules: true,
      showMissingSidecars: true
    });
  });
  it('should handle TOGGLE_GRAPH_CIRCUIT_BREAKERS', () => {
    expect(
      serviceGraphFilterState(
        {
          showNodeLabels: true,
          edgeLabelMode: EdgeLabelMode.NONE,
          showCircuitBreakers: false,
          showRouteRules: true,
          showMissingSidecars: true
        },
        {
          type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS
        }
      )
    ).toEqual({
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.NONE,
      showCircuitBreakers: true,
      showRouteRules: true,
      showMissingSidecars: true
    });
  });
  it('should handle TOGGLE_GRAPH_ROUTE_RULES', () => {
    expect(
      serviceGraphFilterState(
        {
          showNodeLabels: true,
          edgeLabelMode: EdgeLabelMode.NONE,
          showCircuitBreakers: false,
          showRouteRules: true,
          showMissingSidecars: true
        },
        {
          type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_ROUTE_RULES
        }
      )
    ).toEqual({
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.NONE,
      showCircuitBreakers: false,
      showRouteRules: false,
      showMissingSidecars: true
    });
  });
  it('should handle TOGGLE_GRAPH_MISSING_SIDECARS', () => {
    expect(
      serviceGraphFilterState(
        {
          showNodeLabels: true,
          showCircuitBreakers: false,
          showRouteRules: true,
          showMissingSidecars: true,
          edgeLabelMode: EdgeLabelMode.NONE
        },
        {
          type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS
        }
      )
    ).toEqual({
      showNodeLabels: true,
      showCircuitBreakers: false,
      showRouteRules: true,
      showMissingSidecars: false,
      edgeLabelMode: EdgeLabelMode.NONE
    });
  });
});
