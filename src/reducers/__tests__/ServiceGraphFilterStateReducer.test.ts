import serviceGraphFilterState from '../ServiceGraphFilterState';
import { ServiceGraphFilterActionKeys } from '../../actions/ServiceGraphFilterActions';
import { EdgeLabelMode } from '../../types/GraphFilter';

describe('ServiceGraphFilterState reducer', () => {
  it('should return the initial state', () => {
    expect(serviceGraphFilterState(undefined, {})).toEqual({
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.HIDE,
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
          edgeLabelMode: EdgeLabelMode.HIDE,
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
      edgeLabelMode: EdgeLabelMode.HIDE,
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
          edgeLabelMode: EdgeLabelMode.HIDE,
          showCircuitBreakers: false,
          showRouteRules: true,
          showMissingSidecars: true
        },
        {
          type: ServiceGraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
          payload: EdgeLabelMode.LATENCY_95TH_PERCENTILE
        }
      )
    ).toEqual({
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.LATENCY_95TH_PERCENTILE,
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
          edgeLabelMode: EdgeLabelMode.HIDE,
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
      edgeLabelMode: EdgeLabelMode.HIDE,
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
          edgeLabelMode: EdgeLabelMode.HIDE,
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
      edgeLabelMode: EdgeLabelMode.HIDE,
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
          edgeLabelMode: EdgeLabelMode.HIDE
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
      edgeLabelMode: EdgeLabelMode.HIDE
    });
  });
});
