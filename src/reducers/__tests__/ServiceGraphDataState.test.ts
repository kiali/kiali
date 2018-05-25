import serviceGraphDataState from '../ServiceGraphDataState';
import serviceGraphFilterState from '../ServiceGraphFilterState';
import { ServiceGraphActions } from '../../actions/ServiceGraphActions';
import { ServiceGraphDataActions } from '../../actions/ServiceGraphDataActions';

describe('ServiceGraphDataState', () => {
  it('should return the initial state', () => {
    expect(serviceGraphDataState(undefined, {})).toEqual({
      filterState: serviceGraphFilterState(undefined, {}),
      isLoading: false,
      graphDataTimestamp: 0,
      graphData: {},
      sidePanelInfo: null
    });
  });

  it('should handle GET_GRAPH_DATA_START', () => {
    const action = ServiceGraphDataActions.getGraphDataStart();
    const updatedState = serviceGraphDataState(undefined, action);

    expect(updatedState.sidePanelInfo).toBeNull();
    expect(updatedState.isLoading).toBeTruthy();
  });

  it('should handle GET_GRAPH_DATA_SUCCESS', () => {
    const action = ServiceGraphDataActions.getGraphDataSuccess(100, []);
    const updatedState = serviceGraphDataState(undefined, action);

    expect(updatedState).toMatchObject({ isLoading: false, graphDataTimestamp: 100, graphData: [] });
  });

  it('should handle GET_GRAPH_DATA_FAILURE', () => {
    const action = ServiceGraphDataActions.getGraphDataFailure('error description');
    const updatedState = serviceGraphDataState(undefined, action);

    expect(updatedState.isLoading).toBeFalsy();
  });

  it('should handle SERVICE_GRAPH_SIDE_PANEL_SHOW_INFO', () => {
    const action = ServiceGraphActions.showSidePanelInfo({ summaryType: 'node', summaryTarget: 'mynode' });
    const updatedState = serviceGraphDataState(undefined, action);

    expect(updatedState.sidePanelInfo).toEqual({ kind: 'node', graphReference: 'mynode' });
  });
});
