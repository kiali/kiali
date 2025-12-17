import { ChatAIActions } from 'actions/ChatAIActions';
import { store } from 'store/ConfigStore';
import { KialiDispatch } from 'types/Redux';

export const setAIContext = (dispatch: KialiDispatch, context: any) => {
  const state = store.getState();
  if (!state.chatAi.enabled) {
    return;
  }

  dispatch(
    ChatAIActions.setContext({
      ...context,
      namespaces: state.namespaces.activeNamespaces
    })
  );
};
