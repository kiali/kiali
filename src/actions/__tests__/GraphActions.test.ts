import { GraphActionKeys, GraphActions } from '../GraphActions';

describe('GraphActions', () => {
  it('should build "show side panel info" action', () => {
    expect(GraphActions.showSidePanelInfo({ summaryType: 'node', summaryTarget: 'target' })).toEqual({
      type: GraphActionKeys.GRAPH_SIDE_PANEL_SHOW_INFO,
      summaryType: 'node',
      summaryTarget: 'target'
    });
  });

  it('should dispatch "show side panel namespace info" on render', () => {
    let dispatch = jest.fn();
    GraphActions.graphRendered('cyRef')(dispatch);

    expect(dispatch.mock.calls.length).toBe(1);
    expect(dispatch.mock.calls[0][0]).toEqual(
      GraphActions.showSidePanelInfo({
        summaryTarget: 'cyRef',
        summaryType: 'graph'
      })
    );
  });
});
