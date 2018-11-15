import graphDataState from '../GraphDataState';
import graphFilterState from '../GraphFilterState';
import { GraphActions } from '../../actions/GraphActions';
import { GraphDataActions } from '../../actions/GraphDataActions';
import { GlobalActions } from '../../actions/GlobalActions';

describe('GraphDataState', () => {
  it('should return the initial state', () => {
    expect(graphDataState(undefined, GlobalActions.nil())).toEqual({
      filterState: graphFilterState(undefined, GlobalActions.nil()),
      isLoading: false,
      isError: false,
      error: undefined,
      graphDataTimestamp: 0,
      graphData: {},
      sidePanelInfo: null
    });
  });

  it('should handle GET_GRAPH_DATA_START', () => {
    const action = GraphDataActions.getGraphDataStart();
    const updatedState = graphDataState(undefined, action);

    expect(updatedState.sidePanelInfo).toBeNull();
    expect(updatedState.isLoading).toBeTruthy();
  });

  it('should handle GET_GRAPH_DATA_SUCCESS', () => {
    const action = GraphDataActions.getGraphDataSuccess(100, []);
    const updatedState = graphDataState(undefined, action);

    expect(updatedState.isLoading).toBeFalsy();
    expect(updatedState.isError).toBeFalsy();
    expect(updatedState.error).toBeUndefined();
    expect(updatedState).toMatchObject({ isLoading: false, graphDataTimestamp: 100, graphData: [] });
  });

  it('should handle GET_GRAPH_DATA_FAILURE', () => {
    const action = GraphDataActions.getGraphDataFailure('error description');
    const updatedState = graphDataState(undefined, action);

    expect(updatedState.isLoading).toBeFalsy();
    expect(updatedState.isError).toBeTruthy();
    expect(updatedState.error).toBeDefined();
  });

  it('should handle GRAPH_SIDE_PANEL_SHOW_INFO', () => {
    const action = GraphActions.showSidePanelInfo({ summaryType: 'node', summaryTarget: 'mynode' });
    const updatedState = graphDataState(undefined, action);

    expect(updatedState.sidePanelInfo).toEqual({ kind: 'node', graphReference: 'mynode' });
  });
});
