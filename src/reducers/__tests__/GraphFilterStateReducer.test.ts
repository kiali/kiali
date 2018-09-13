import graphFilterState from '../GraphFilterState';
import { GraphFilterActionKeys } from '../../actions/GraphFilterActions';

describe('GraphFilterState reducer', () => {
  it('should return the initial state', () => {
    expect(graphFilterState(undefined, {})).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: true,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });

  it('should handle TOGGLE_LEGEND', () => {
    expect(
      graphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: GraphFilterActionKeys.TOGGLE_LEGEND
        }
      )
    ).toEqual({
      showLegend: true,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });

  it('should handle TOGGLE_GRAPH_NODE_LABEL', () => {
    expect(
      graphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: GraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: false,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });

  it('should handle TOGGLE_GRAPH_CIRCUIT_BREAKERS', () => {
    expect(
      graphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: GraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: true,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });
  it('should handle TOGGLE_GRAPH_VIRTUAL_SERVICES', () => {
    expect(
      graphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: GraphFilterActionKeys.TOGGLE_GRAPH_VIRTUAL_SERVICES
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: false,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });
  it('should handle TOGGLE_GRAPH_MISSING_SIDECARS', () => {
    expect(
      graphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: GraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: false,
      showTrafficAnimation: false,
      refreshRate: 15000
    });
  });
  it('should handle TOGGLE_TRAFFIC_ANIMATION', () => {
    expect(
      graphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: GraphFilterActionKeys.TOGGLE_TRAFFIC_ANIMATION
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: true,
      refreshRate: 15000
    });
  });
  it('should handle SET_GRAPH_REFRESH_RATE', () => {
    expect(
      graphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showTrafficAnimation: false,
          refreshRate: 15000
        },
        {
          type: GraphFilterActionKeys.SET_GRAPH_REFRESH_RATE,
          payload: 10000
        }
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showTrafficAnimation: false,
      refreshRate: 10000
    });
  });
});
