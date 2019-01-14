import { GraphActions } from '../GraphActions';
import GraphThunkActions from '../GraphThunkActions';
import { getType } from 'typesafe-actions';

describe('GraphActions', () => {
  it('should build "update summary" action', () => {
    const showAction = GraphActions.updateSummary({ summaryType: 'node', summaryTarget: 'target' });
    expect(showAction.type).toEqual(getType(GraphActions.updateSummary));
    expect(showAction.payload).toEqual({
      summaryType: 'node',
      summaryTarget: 'target'
    });
  });

  it('should dispatch "update summary" action on render', () => {
    const dispatch = jest.fn();
    GraphThunkActions.graphReady('cyRef')(dispatch);

    expect(dispatch.mock.calls.length).toBe(1);
    expect(dispatch.mock.calls[0][0]).toEqual(
      GraphActions.updateSummary({
        summaryTarget: 'cyRef',
        summaryType: 'graph'
      })
    );
  });
});
