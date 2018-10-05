import { GraphFilterActionKeys, GraphFilterActions } from '../GraphFilterActions';
import { EdgeLabelMode } from '../../types/GraphFilter';

// Test our ActionCreators for proper message format
describe('GraphFilterActions', () => {
  it('should toggle an edge label ', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
      payload: EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE
    };
    expect(GraphFilterActions.setGraphEdgeLabelMode(EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE)).toEqual(
      expectedAction
    );
  });

  it('should toggle the legend ', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_LEGEND
    };
    expect(GraphFilterActions.toggleLegend()).toEqual(expectedAction);
  });

  it('should toggle a node label ', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL
    };
    expect(GraphFilterActions.toggleGraphNodeLabel()).toEqual(expectedAction);
  });

  it('should toggle a circuit breaker ', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS
    };
    expect(GraphFilterActions.toggleGraphCircuitBreakers()).toEqual(expectedAction);
  });

  it('should toggle a virtual service', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_GRAPH_VIRTUAL_SERVICES
    };
    expect(GraphFilterActions.toggleGraphVirtualServices()).toEqual(expectedAction);
  });

  it('should toggle missing sidecars', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS
    };
    expect(GraphFilterActions.toggleGraphMissingSidecars()).toEqual(expectedAction);
  });

  it('should toggle security', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_GRAPH_SECURITY
    };
    expect(GraphFilterActions.toggleGraphSecurity()).toEqual(expectedAction);
  });

  it('should toggle service nodes', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_SERVICE_NODES
    };
    expect(GraphFilterActions.toggleServiceNodes()).toEqual(expectedAction);
  });

  it('should toggle traffic animations', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_TRAFFIC_ANIMATION
    };
    expect(GraphFilterActions.toggleTrafficAnimation()).toEqual(expectedAction);
  });

  it('should toggle unused nodes', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_UNUSED_NODES
    };
    expect(GraphFilterActions.toggleUnusedNodes()).toEqual(expectedAction);
  });

  it('should enable graph filters toggles', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.ENABLE_GRAPH_FILTERS,
      payload: true
    };
    expect(GraphFilterActions.showGraphFilters(true)).toEqual(expectedAction);
  });

  it('should disable graph filters toggles', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.ENABLE_GRAPH_FILTERS,
      payload: false
    };
    expect(GraphFilterActions.showGraphFilters(false)).toEqual(expectedAction);
  });

  it('should set graph refresh rate to 0', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.SET_GRAPH_REFRESH_RATE,
      payload: 0
    };
    expect(GraphFilterActions.setRefreshRate(0)).toEqual(expectedAction);
  });

  it('should set graph refresh rate to 15000', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.SET_GRAPH_REFRESH_RATE,
      payload: 15000
    };
    expect(GraphFilterActions.setRefreshRate(15000)).toEqual(expectedAction);
  });
});
