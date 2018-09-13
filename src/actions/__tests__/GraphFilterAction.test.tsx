import { GraphFilterActionKeys, graphFilterActions } from '../GraphFilterActions';
import { EdgeLabelMode } from '../../types/GraphFilter';

// Test our ActionCreators for proper message format
describe('GraphFilterActions', () => {
  it('should toggle an edge label ', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
      payload: EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE
    };
    expect(graphFilterActions.setGraphEdgeLabelMode(EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE)).toEqual(
      expectedAction
    );
  });

  it('should toggle the legend ', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_LEGEND
    };
    expect(graphFilterActions.toggleLegend()).toEqual(expectedAction);
  });

  it('should toggle a node label ', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL
    };
    expect(graphFilterActions.toggleGraphNodeLabel()).toEqual(expectedAction);
  });

  it('should toggle a circuit breaker ', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS
    };
    expect(graphFilterActions.toggleGraphCircuitBreakers()).toEqual(expectedAction);
  });

  it('should toggle a virtual service', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_GRAPH_VIRTUAL_SERVICES
    };
    expect(graphFilterActions.toggleGraphVirtualServices()).toEqual(expectedAction);
  });

  it('should toggle missing sidecars', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS
    };
    expect(graphFilterActions.toggleGraphMissingSidecars()).toEqual(expectedAction);
  });

  it('should toggle traffic animations', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.TOGGLE_TRAFFIC_ANIMATION
    };
    expect(graphFilterActions.toggleTrafficAnimation()).toEqual(expectedAction);
  });

  it('should enable graph filters toggles', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.ENABLE_GRAPH_FILTERS,
      payload: true
    };
    expect(graphFilterActions.showGraphFilters(true)).toEqual(expectedAction);
  });

  it('should disable graph filters toggles', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.ENABLE_GRAPH_FILTERS,
      payload: false
    };
    expect(graphFilterActions.showGraphFilters(false)).toEqual(expectedAction);
  });

  it('should set graph refresh rate to 0', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.SET_GRAPH_REFRESH_RATE,
      payload: 0
    };
    expect(graphFilterActions.setRefreshRate(0)).toEqual(expectedAction);
  });

  it('should set graph refresh rate to 15000', () => {
    const expectedAction = {
      type: GraphFilterActionKeys.SET_GRAPH_REFRESH_RATE,
      payload: 15000
    };
    expect(graphFilterActions.setRefreshRate(15000)).toEqual(expectedAction);
  });
});
