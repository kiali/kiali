import serviceGraphFilterState from '../ServiceGraphFilterState';
import { ServiceGraphFilterActionKeys } from '../../actions/ServiceGraphFilterActions';
import { EdgeLabelMode } from '../../types/GraphFilter';

describe('ServiceGraphFilterState reducer', () => {
  it('should return the initial state', () => {
    expect(serviceGraphFilterState(undefined, {})).toEqual({
      showLegend: false,
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.HIDE,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });

  it('should handle TOGGLE_LEGEND', () => {
    expect(
      serviceGraphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          edgeLabelMode: EdgeLabelMode.HIDE,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: ServiceGraphFilterActionKeys.TOGGLE_LEGEND
        }
      )
    ).toEqual({
      showLegend: true,
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.HIDE,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });

  it('should handle TOGGLE_GRAPH_NODE_LABEL', () => {
    expect(
      serviceGraphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          edgeLabelMode: EdgeLabelMode.HIDE,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: false,
      edgeLabelMode: EdgeLabelMode.HIDE,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });

  it('should handle TOGGLE_GRAPH_EDGE_LABEL', () => {
    expect(
      serviceGraphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          edgeLabelMode: EdgeLabelMode.HIDE,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: ServiceGraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
          payload: EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });
  it('should handle TOGGLE_GRAPH_CIRCUIT_BREAKERS', () => {
    expect(
      serviceGraphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          edgeLabelMode: EdgeLabelMode.HIDE,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.HIDE,
      showCircuitBreakers: true,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });
  it('should handle TOGGLE_GRAPH_VIRTUAL_SERVICES', () => {
    expect(
      serviceGraphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          edgeLabelMode: EdgeLabelMode.HIDE,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_VIRTUAL_SERVICES
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      edgeLabelMode: EdgeLabelMode.HIDE,
      showCircuitBreakers: false,
      showVirtualServices: false,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });
  it('should handle TOGGLE_GRAPH_MISSING_SIDECARS', () => {
    expect(
      serviceGraphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          edgeLabelMode: EdgeLabelMode.HIDE,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: false,
      edgeLabelMode: EdgeLabelMode.HIDE,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });
  it('should handle TOGGLE_TRAFFIC_ANIMATION', () => {
    expect(
      serviceGraphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          edgeLabelMode: EdgeLabelMode.HIDE,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: ServiceGraphFilterActionKeys.TOGGLE_TRAFFIC_ANIMATION
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      edgeLabelMode: EdgeLabelMode.HIDE,
      showTrafficAnimation: true,
      refreshRate: 15000
    });
  });
  it('should handle SET_GRAPH_REFRESH_RATE', () => {
    expect(
      serviceGraphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          edgeLabelMode: EdgeLabelMode.HIDE,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: ServiceGraphFilterActionKeys.SET_GRAPH_REFRESH_RATE,
          payload: 10000
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      edgeLabelMode: EdgeLabelMode.HIDE,
      showTrafficAnimation: false,
      refreshRate: 10000
    });
  });
});
