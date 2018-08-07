import { GlobalActionKeys, GlobalActions } from '../GlobalActions';

describe('GlobalActions', () => {
  it('should increment Loading counter', () => {
    expect(GlobalActions.incrementLoadingCounter()).toEqual({
      type: GlobalActionKeys.INCREMENT_LOADING_COUNTER
    });
  });
  it('should decrement Loading counter', () => {
    expect(GlobalActions.decrementLoadingCounter()).toEqual({
      type: GlobalActionKeys.DECREMENT_LOADING_COUNTER
    });
  });
  it('should set page visibility to hidden', () => {
    expect(GlobalActions.setPageVisibilityHidden()).toEqual({
      type: GlobalActionKeys.SET_PAGE_VISIBILITY_HIDDEN
    });
  });
  it('should set page visibility to visible', () => {
    expect(GlobalActions.setPageVisibilityVisible()).toEqual({
      type: GlobalActionKeys.SET_PAGE_VISIBILITY_VISIBLE
    });
  });
});
