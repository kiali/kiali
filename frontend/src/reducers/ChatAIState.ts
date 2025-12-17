import { ChatAIState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { ChatAIActions } from 'actions/ChatAIActions';

export const INITIAL_CHAT_AI_STATE: ChatAIState = {
  enabled: false,
  context: undefined,
  providers: [],
  defaultProvider: ''
};

// This Reducer allows changes to the 'globalState' portion of Redux Store
export const ChatAiStateReducer = (state: ChatAIState = INITIAL_CHAT_AI_STATE, action: KialiAppAction): ChatAIState => {
  switch (action.type) {
    case getType(ChatAIActions.setContext):
      return updateState(state, { context: action.payload });
    case getType(ChatAIActions.setChatAI):
      return updateState(state, {
        enabled: action.payload.enabled,
        providers: action.payload.providers,
        defaultProvider: action.payload.defaultProvider
      });
    default:
      return state;
  }
};
