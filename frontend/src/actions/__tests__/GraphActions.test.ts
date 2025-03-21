import { Controller, GraphElement } from '@patternfly/react-topology';
import { GraphActions } from '../GraphActions';
import { GraphThunkActions } from '../GraphThunkActions';
import { getType } from 'typesafe-actions';

describe('GraphActions', () => {
  it('should build "update summary" action', () => {
    const showAction = GraphActions.updateSummary({ summaryType: 'node', summaryTarget: {} as GraphElement });
    expect(showAction.type).toEqual(getType(GraphActions.updateSummary));
    expect(showAction.payload).toEqual({
      summaryType: 'node',
      summaryTarget: {} as GraphElement
    });
  });

  it('should dispatch "update summary" action on render', () => {
    const dispatch = jest.fn();
    GraphThunkActions.graphReady({} as Controller)(dispatch);

    expect(dispatch.mock.calls.length).toBe(1);
    expect(dispatch.mock.calls[0][0]).toEqual(
      GraphActions.updateSummary({
        summaryTarget: {} as Controller,
        summaryType: 'graph'
      })
    );
  });
});
