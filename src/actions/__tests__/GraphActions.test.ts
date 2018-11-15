import { GraphActions, GraphThunkActions } from '../GraphActions';
import { getType } from 'typesafe-actions';

describe('GraphActions', () => {
  it('should build "show side panel info" action', () => {
    const showAction = GraphActions.showSidePanelInfo({ summaryType: 'node', summaryTarget: 'target' });
    expect(showAction.type).toEqual(getType(GraphActions.showSidePanelInfo));
    expect(showAction.payload).toEqual({
      summaryType: 'node',
      summaryTarget: 'target'
    });
  });

  it('should dispatch "show side panel namespace info" on render', () => {
    let dispatch = jest.fn();
    GraphThunkActions.graphRendered('cyRef')(dispatch);

    expect(dispatch.mock.calls.length).toBe(1);
    expect(dispatch.mock.calls[0][0]).toEqual(
      GraphActions.showSidePanelInfo({
        summaryTarget: 'cyRef',
        summaryType: 'graph'
      })
    );
  });
});
