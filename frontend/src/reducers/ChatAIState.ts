import { combineReducers } from 'redux';
import type { AIState, ChatAIState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import type { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { ChatAIActions } from 'actions/ChatAIActions';
import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { ChatbotDisplayMode } from '@patternfly/chatbot';

export const INITIAL_CHAT_AI_STATE: ChatAIState = {
  allowed: false,
  alwaysNavigate: false,
  chatHistory: ImmutableList(),
  conversationID: '',
  defaultProvider: '',
  displayMode: ChatbotDisplayMode.default,
  enabled: false,
  interactionMode: 'ask',
  openTool: ImmutableMap({ chatEntryIndex: null, id: null }),
  providers: [],
  query: '',
  resourceHealth: undefined,
  selectedModel: '',
  selectedProvider: ''
};

// This Reducer manages the 'ai.chatAI' portion of Redux Store
export const ChatAiStateReducer = (state: ChatAIState = INITIAL_CHAT_AI_STATE, action: KialiAppAction): ChatAIState => {
  switch (action.type) {
    case getType(ChatAIActions.setChatAI): {
      // The backend may send "providers: null" (e.g. when ChatAI is disabled or unconfigured).
      const providers = action.payload.providers ?? [];
      const defaultProvider = providers.find(provider => provider.name === action.payload.defaultProvider);
      return updateState(state, {
        allowed: action.payload.allowed,
        enabled: action.payload.enabled,
        providers,
        defaultProvider: action.payload.defaultProvider,
        selectedProvider: action.payload.defaultProvider,
        selectedModel: defaultProvider?.defaultModel || defaultProvider?.models[0]?.name
      });
    }
    case getType(ChatAIActions.setConversationID): {
      return updateState(state, { conversationID: action.payload.id ?? '' });
    }
    case getType(ChatAIActions.setSelectedProvider): {
      return updateState(state, { selectedProvider: action.payload.provider });
    }
    case getType(ChatAIActions.setSelectedModel): {
      return updateState(state, { selectedModel: action.payload.model });
    }
    case getType(ChatAIActions.setChatHistoryClear): {
      return updateState(state, { chatHistory: ImmutableList() });
    }
    case getType(ChatAIActions.setChatHistoryAdd): {
      const history = state.chatHistory.push(ImmutableMap(action.payload.entry));
      return updateState(state, { chatHistory: history });
    }
    case getType(ChatAIActions.setQuery): {
      return updateState(state, { query: action.payload });
    }
    case getType(ChatAIActions.setChatHistoryUpdateById): {
      const index = state.chatHistory.findIndex((entry: any) => entry.get('id') === action.payload.id);
      const history = index > -1 ? state.chatHistory.mergeIn([index], action.payload.entry) : state.chatHistory;
      return updateState(state, { chatHistory: history });
    }
    case getType(ChatAIActions.setChatHistoryUpdateTool): {
      const index = state.chatHistory.findIndex((entry: any) => entry.get('id') === action.payload.id);
      const history =
        index > -1
          ? state.chatHistory.mergeIn([index, 'tools', action.payload.toolID], action.payload.tool)
          : state.chatHistory;
      return updateState(state, { chatHistory: history });
    }
    case getType(ChatAIActions.setOpenTool): {
      return updateState(state, {
        openTool: state.openTool.set('chatEntryIndex', action.payload.chatEntryIndex).set('id', action.payload.id)
      });
    }
    case getType(ChatAIActions.clearOpenTool): {
      return updateState(state, {
        openTool: state.openTool.set('chatEntryIndex', null).set('id', null)
      });
    }
    case getType(ChatAIActions.setAlwaysNavigate): {
      return updateState(state, { alwaysNavigate: action.payload.alwaysNavigate });
    }
    case getType(ChatAIActions.setDisplayMode): {
      return updateState(state, { displayMode: action.payload.displayMode });
    }
    case getType(ChatAIActions.setInteractionMode): {
      return updateState(state, { interactionMode: action.payload.interactionMode });
    }
    case getType(ChatAIActions.setResourceHealth): {
      return updateState(state, { resourceHealth: action.payload });
    }
    case getType(ChatAIActions.clearResourceHealth): {
      return updateState(state, { resourceHealth: undefined });
    }
    default:
      return state;
  }
};

const INITIAL_AI_ENABLED_STATE = false;

// The overall "AI" feature master switch. Today ChatAI is the only AI feature, so it mirrors
// the ChatAI "enabled" flag, but it is kept separate so other AI features can toggle it independently.
const AiEnabledReducer = (state: boolean = INITIAL_AI_ENABLED_STATE, action: KialiAppAction): boolean => {
  switch (action.type) {
    case getType(ChatAIActions.setChatAI):
      return action.payload.enabled;
    default:
      return state;
  }
};

// This Reducer allows changes to the 'ai' portion of Redux Store
export const AiStateReducer = combineReducers<AIState, KialiAppAction>({
  chatAI: ChatAiStateReducer,
  enabled: AiEnabledReducer
});
