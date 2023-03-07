import { GraphToolbarActions } from '../GraphToolbarActions';
import { EdgeLabelMode } from '../../types/Graph';

// Test our ActionCreators for proper message format
describe('GraphToolbarActions', () => {
  it('should toggle an edge label ', () => {
    const action = GraphToolbarActions.setEdgeLabels([EdgeLabelMode.RESPONSE_TIME_P95]);
    expect(action.payload).toEqual([EdgeLabelMode.RESPONSE_TIME_P95]);
  });
});
