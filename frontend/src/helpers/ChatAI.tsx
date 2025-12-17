import { ChatAIActions } from 'actions/ChatAIActions';
import { store } from 'store/ConfigStore';
import { KialiDispatch } from 'types/Redux';

export const setAIContext = (dispatch: KialiDispatch, pageDescription: string) => {
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
      page_url: pageUrl,
      page_namespaces: state.namespaces.activeNamespaces.map(ns => ns.name)
    })
  );
};
