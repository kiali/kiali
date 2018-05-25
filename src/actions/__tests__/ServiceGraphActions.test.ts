import { ServiceGraphActionKeys, ServiceGraphActions } from '../ServiceGraphActions';

describe('ServiceGraphActions', () => {
  it('should build "show side panel info" action', () => {
    expect(ServiceGraphActions.showSidePanelInfo({ summaryType: 'node', summaryTarget: 'target' })).toEqual({
      type: ServiceGraphActionKeys.SERVICE_GRAPH_SIDE_PANEL_SHOW_INFO,
      summaryType: 'node',
      summaryTarget: 'target'
    });
  });

  it('should dispatch "show side panel namespace info" on render', () => {
    let dispatch = jest.fn();
    ServiceGraphActions.graphRendered('cyRef')(dispatch);

    expect(dispatch.mock.calls.length).toBe(1);
    expect(dispatch.mock.calls[0][0]).toEqual(
      ServiceGraphActions.showSidePanelInfo({
        summaryTarget: 'cyRef',
        summaryType: 'graph'
      })
    );
  });
});
