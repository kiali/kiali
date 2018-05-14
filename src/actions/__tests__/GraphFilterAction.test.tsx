import { ServiceGraphFilterActionKeys, serviceGraphFilterActions } from '../ServiceGraphFilterActions';
import { EdgeLabelMode } from '../../types/GraphFilter';

// Test our ActionCreators for proper message format
describe('GraphFilterActions', () => {
  it('should toggle an edge label ', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
      payload: EdgeLabelMode.LATENCY
    };
    expect(serviceGraphFilterActions.setGraphEdgeLabelMode(EdgeLabelMode.LATENCY)).toEqual(expectedAction);
  });

  it('should toggle a node label ', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_NODE_LABEL
    };
    expect(serviceGraphFilterActions.toggleGraphNodeLabel()).toEqual(expectedAction);
  });

  it('should toggle a circuit breaker ', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_CIRCUIT_BREAKERS
    };
    expect(serviceGraphFilterActions.toggleGraphCircuitBreakers()).toEqual(expectedAction);
  });

  it('should toggle a route rule', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_ROUTE_RULES
    };
    expect(serviceGraphFilterActions.toggleGraphRouteRules()).toEqual(expectedAction);
  });

  it('should toggle missing sidecars', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS
    };
    expect(serviceGraphFilterActions.toggleGraphMissingSidecars()).toEqual(expectedAction);
  });

  it('should enable graph filters toggles', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.ENABLE_GRAPH_FILTERS,
      payload: true
    };
    expect(serviceGraphFilterActions.showGraphFilters(true)).toEqual(expectedAction);
  });

  it('should disable graph filters toggles', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.ENABLE_GRAPH_FILTERS,
      payload: false
    };
    expect(serviceGraphFilterActions.showGraphFilters(false)).toEqual(expectedAction);
  });
});
