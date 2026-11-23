import { getType } from 'types/typesafeActionsLegacy';
import { GlobalActions } from '../../actions/GlobalActions';
import { store } from '../../store/ConfigStore';
import { registerPageVisibilitySync, syncPageVisibilityToStore } from '../pageVisibility';

const setDocumentVisibilityState = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state
  });
};

describe('pageVisibility', () => {
  let dispatchSpy: ReturnType<typeof rstest.spyOn>;
  let nativeVisibilityState: DocumentVisibilityState;

  beforeEach(() => {
    nativeVisibilityState = document.visibilityState;
    dispatchSpy = rstest.spyOn(store, 'dispatch');
    dispatchSpy.mockClear();
    store.dispatch(GlobalActions.setPageVisibilityVisible());
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
    setDocumentVisibilityState(nativeVisibilityState);
  });

  describe('syncPageVisibilityToStore', () => {
    const cases: { expectedVisible: boolean; state: DocumentVisibilityState }[] = [
      { state: 'visible', expectedVisible: true },
      { state: 'hidden', expectedVisible: false }
    ];

    cases.forEach(({ state, expectedVisible }) => {
      it(`maps visibilityState "${state}" to isPageVisible=${expectedVisible}`, () => {
        setDocumentVisibilityState(state);
        dispatchSpy.mockClear();

        syncPageVisibilityToStore();

        const expectedType = expectedVisible
          ? getType(GlobalActions.setPageVisibilityVisible)
          : getType(GlobalActions.setPageVisibilityHidden);
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: expectedType }));
        expect(store.getState().globalState.isPageVisible).toBe(expectedVisible);
      });
    });
  });

  describe('registerPageVisibilitySync', () => {
    it('registers listener, syncs on subscribe, and removes listener on cleanup', () => {
      const addListenerSpy = rstest.spyOn(document, 'addEventListener');
      const removeListenerSpy = rstest.spyOn(document, 'removeEventListener');
      setDocumentVisibilityState('hidden');
      dispatchSpy.mockClear();

      const cleanup = registerPageVisibilitySync();

      expect(addListenerSpy).toHaveBeenCalledWith('visibilitychange', syncPageVisibilityToStore);
      expect(store.getState().globalState.isPageVisible).toBe(false);

      setDocumentVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(store.getState().globalState.isPageVisible).toBe(true);

      cleanup();
      expect(removeListenerSpy).toHaveBeenCalledWith('visibilitychange', syncPageVisibilityToStore);

      addListenerSpy.mockRestore();
      removeListenerSpy.mockRestore();
    });
  });
});
