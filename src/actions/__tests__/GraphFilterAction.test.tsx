import { GraphFilterActions } from '../GraphFilterActions';
import { EdgeLabelMode } from '../../types/GraphFilter';

// Test our ActionCreators for proper message format
describe('GraphFilterActions', () => {
  it('should toggle an edge label ', () => {
    const action = GraphFilterActions.setEdgelLabelMode(EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE);
    expect(action.payload).toEqual(EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE);
  });

  it('should enable graph filters toggles', () => {
    const action = GraphFilterActions.showGraphFilters(true);
    expect(action.payload).toBeTruthy();
  });

  it('should disable graph filters toggles', () => {
    const action = GraphFilterActions.showGraphFilters(false);
    expect(action.payload).toBeFalsy();
  });
});
