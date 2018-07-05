import { ServiceGraphFilterActionKeys, serviceGraphFilterActions } from '../ServiceGraphFilterActions';
import { EdgeLabelMode } from '../../types/GraphFilter';

// Test our ActionCreators for proper message format
describe('GraphFilterActions', () => {
  it('should toggle an edge label ', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.SET_GRAPH_EDGE_LABEL_MODE,
      payload: EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE
    };
    expect(serviceGraphFilterActions.setGraphEdgeLabelMode(EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE)).toEqual(
      expectedAction
    );
  });

  it('should toggle the legend ', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.TOGGLE_LEGEND
    };
    expect(serviceGraphFilterActions.toggleLegend()).toEqual(expectedAction);
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

  it('should toggle a virtual service', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_VIRTUAL_SERVICES
    };
    expect(serviceGraphFilterActions.toggleGraphVirtualServices()).toEqual(expectedAction);
  });

  it('should toggle missing sidecars', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.TOGGLE_GRAPH_MISSING_SIDECARS
    };
    expect(serviceGraphFilterActions.toggleGraphMissingSidecars()).toEqual(expectedAction);
  });

  it('should toggle traffic animations', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.TOGGLE_TRAFFIC_ANIMATION
    };
    expect(serviceGraphFilterActions.toggleTrafficAnimation()).toEqual(expectedAction);
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

  it('should set graph refresh rate to 0', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.SET_GRAPH_REFRESH_RATE,
      payload: 0
    };
    expect(serviceGraphFilterActions.setRefreshRate(0)).toEqual(expectedAction);
  });

  it('should set graph refresh rate to 15000', () => {
    const expectedAction = {
      type: ServiceGraphFilterActionKeys.SET_GRAPH_REFRESH_RATE,
      payload: 15000
    };
    expect(serviceGraphFilterActions.setRefreshRate(15000)).toEqual(expectedAction);
  });
});
