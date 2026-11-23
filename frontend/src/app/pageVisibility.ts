import { GlobalActions } from '../actions/GlobalActions';
import { store } from '../store/ConfigStore';

/** Keep Redux `isPageVisible` aligned with the tab; non-visible includes `prerender`. */
export const syncPageVisibilityToStore = (): void => {
  // https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState
  if (document.visibilityState === 'visible') {
    store.dispatch(GlobalActions.setPageVisibilityVisible());
  } else {
    store.dispatch(GlobalActions.setPageVisibilityHidden());
  }
};

export const registerPageVisibilitySync = (): (() => void) => {
  document.addEventListener('visibilitychange', syncPageVisibilityToStore);
  syncPageVisibilityToStore();
  return () => {
    document.removeEventListener('visibilitychange', syncPageVisibilityToStore);
  };
};
