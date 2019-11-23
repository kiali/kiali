import { GraphToolbarActions } from '../GraphToolbarActions';
import { EdgeLabelMode } from '../../types/Graph';

// Test our ActionCreators for proper message format
describe('GraphToolbarActions', () => {
  it('should toggle an edge label ', () => {
    const action = GraphToolbarActions.setEdgelLabelMode(EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE);
    expect(action.payload).toEqual(EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE);
  });
});
