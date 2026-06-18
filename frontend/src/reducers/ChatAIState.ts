import { ChatAIState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { ChatAIActions } from 'actions/ChatAIActions';
import { Map as ImmutableMap, List as ImmutableList } from 'immutable';
import { ChatbotDisplayMode } from '@patternfly/chatbot';

export const INITIAL_CHAT_AI_STATE: ChatAIState = {
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
  selectedModel: '',
  selectedProvider: ''
};

// This Reducer allows changes to the 'globalState' portion of Redux Store
export const ChatAiStateReducer = (state: ChatAIState = INITIAL_CHAT_AI_STATE, action: KialiAppAction): ChatAIState => {
  switch (action.type) {
    case getType(ChatAIActions.setChatAI):
      return updateState(state, {
        enabled: action.payload.enabled,
        providers: action.payload.providers,
        defaultProvider: action.payload.defaultProvider,
        selectedProvider: action.payload.defaultProvider,
        selectedModel:
          action.payload.providers.find(provider => provider.name === action.payload.defaultProvider)?.defaultModel ||
          action.payload.providers.find(provider => provider.name === action.payload.defaultProvider)?.models[0].name
      });
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
    default:
      return state;
  }
};
