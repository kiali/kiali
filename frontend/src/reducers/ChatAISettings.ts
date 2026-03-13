import { ChatAISettings } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { ChatAISettingsActions } from 'actions/ChatAIActions';
import { ChatbotDisplayMode } from '@patternfly/chatbot';

export const INITIAL_CHAT_AI_SETTINGS: ChatAISettings = {
  enabled: false,
  context: undefined,
  providers: [],
  defaultProvider: '',
  displayMode: ChatbotDisplayMode.default
};

// This Reducer allows changes to the 'globalState' portion of Redux Store
export const ChatAiSettingsReducer = (
  state: ChatAISettings = INITIAL_CHAT_AI_SETTINGS,
  action: KialiAppAction
): ChatAISettings => {
  switch (action.type) {
    case getType(ChatAISettingsActions.setContext):
      return updateState(state, { context: action.payload });
    case getType(ChatAISettingsActions.setChatAI):
      return updateState(state, {
        enabled: action.payload.enabled,
        providers: action.payload.providers,
        defaultProvider: action.payload.defaultProvider
      });
    case getType(ChatAISettingsActions.setDisplayMode):
      return updateState(state, { displayMode: action.payload.displayMode as ChatbotDisplayMode });
    default:
      return state;
  }
};
