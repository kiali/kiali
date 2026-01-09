import { ChatAIActions } from 'actions/ChatAIActions';
import { store } from 'store/ConfigStore';
import { KialiDispatch } from 'types/Redux';

export const setAIContext = (dispatch: KialiDispatch, context: any, pageDescription: string) => {
  const state = store.getState();
  if (!state.chatAi.enabled) {
    return;
  }

  let pageUrl = window.location.pathname;
  if (pageUrl.startsWith('/console')) {
    pageUrl = pageUrl.replace('/console', '');
  }
  if (pageUrl.startsWith('/kiali')) {
    pageUrl = pageUrl.replace('/kiali', '');
  }

  dispatch(
    ChatAIActions.setContext({
      page_description: pageDescription,
      page_state: context,
      page_url: pageUrl
    })
  );
};
