import graphFilterState from '../GraphFilterState';
import { GraphFilterActions } from '../../actions/GraphFilterActions';
import { GlobalActions } from '../../actions/GlobalActions';

describe('GraphFilterState reducer', () => {
  it('should return the initial state', () => {
    expect(graphFilterState(undefined, GlobalActions.nil())).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: true,
      showVirtualServices: true,
      showMissingSidecars: true,
      showSecurity: false,
      showTrafficAnimation: false,
      showServiceNodes: false,
      showUnusedNodes: false
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
          showSecurity: false,
          showTrafficAnimation: false,
          showServiceNodes: false,
          showUnusedNodes: false
        },
        GraphFilterActions.toggleLegend()
      )
    ).toEqual({
      showLegend: true,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showSecurity: false,
      showTrafficAnimation: false,
      showServiceNodes: false,
      showUnusedNodes: false
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
          showSecurity: false,
          showTrafficAnimation: false,
          showServiceNodes: false,
          showUnusedNodes: false
        },
        GraphFilterActions.toggleGraphNodeLabel()
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: false,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showSecurity: false,
      showTrafficAnimation: false,
      showServiceNodes: false,
      showUnusedNodes: false
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
          showSecurity: false,
          showTrafficAnimation: false,
          showServiceNodes: false,
          showUnusedNodes: false
        },
        GraphFilterActions.toggleGraphCircuitBreakers()
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: true,
      showVirtualServices: true,
      showMissingSidecars: true,
      showSecurity: false,
      showTrafficAnimation: false,
      showServiceNodes: false,
      showUnusedNodes: false
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
          showSecurity: false,
          showTrafficAnimation: false,
          showServiceNodes: false,
          showUnusedNodes: false
        },
        GraphFilterActions.toggleGraphVirtualServices()
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: false,
      showMissingSidecars: true,
      showSecurity: false,
      showTrafficAnimation: false,
      showServiceNodes: false,
      showUnusedNodes: false
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
          showSecurity: false,
          showTrafficAnimation: false,
          showServiceNodes: false,
          showUnusedNodes: false
        },
        GraphFilterActions.toggleGraphMissingSidecars()
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: false,
      showSecurity: false,
      showTrafficAnimation: false,
      showServiceNodes: false,
      showUnusedNodes: false
    });
  });
  it('should handle TOGGLE_GRAPH_SECURITY', () => {
    expect(
      graphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showSecurity: false,
          showTrafficAnimation: false,
          showServiceNodes: false,
          showUnusedNodes: false
        },
        GraphFilterActions.toggleGraphSecurity()
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showSecurity: true,
      showTrafficAnimation: false,
      showServiceNodes: false,
      showUnusedNodes: false
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
          showSecurity: false,
          showTrafficAnimation: false,
          showServiceNodes: false,
          showUnusedNodes: false
        },
        GraphFilterActions.toggleTrafficAnimation()
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showSecurity: false,
      showTrafficAnimation: true,
      showServiceNodes: false,
      showUnusedNodes: false
    });
  });
  it('should handle TOGGLE_SERVICE_NODES', () => {
    expect(
      graphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showSecurity: false,
          showTrafficAnimation: false,
          showServiceNodes: false,
          showUnusedNodes: false
        },
        GraphFilterActions.toggleServiceNodes()
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showSecurity: false,
      showTrafficAnimation: false,
      showServiceNodes: true,
      showUnusedNodes: false
    });
  });
  it('should handle TOGGLE_UNUSED_NODES', () => {
    expect(
      graphFilterState(
        {
          showLegend: false,
          showNodeLabels: true,
          showCircuitBreakers: false,
          showVirtualServices: true,
          showMissingSidecars: true,
          showSecurity: false,
          showTrafficAnimation: false,
          showServiceNodes: false,
          showUnusedNodes: false
        },
        GraphFilterActions.toggleUnusedNodes()
      )
    ).toEqual({
      showLegend: false,
      showNodeLabels: true,
      showCircuitBreakers: false,
      showVirtualServices: true,
      showMissingSidecars: true,
      showSecurity: false,
      showTrafficAnimation: false,
      showServiceNodes: false,
      showUnusedNodes: true
    });
  });
});
