import { combineReducers } from 'redux';
import type { AIRightView, AIState, ChatAIState, TroubleshootingAIState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import type { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { ChatAIActions } from 'actions/ChatAIActions';
import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { ChatbotDisplayMode } from '@patternfly/chatbot';
import type { ChatAIConfig, TroubleshootingConversation } from 'types/Chatbot';
import { readHiddenSubProblemIds } from 'utils/TroubleshootingStorage';

export const INITIAL_AI_RIGHT_VIEW_STATE: AIRightView = {
  allowed: false,
  enabled: false
};

export const INITIAL_TROUBLESHOOTING_STATE: TroubleshootingAIState = {
  ai_support: INITIAL_AI_RIGHT_VIEW_STATE,
  allowed: false,
  conversations: [],
  drawerExpanded: false,
  enabled: false,
  error: '',
  hiddenSubProblemIds: readHiddenSubProblemIds(),
  issues: [],
  loaded: false,
  openAnalyses: 0
};

/** @deprecated use INITIAL_AI_RIGHT_VIEW_STATE */
export const INITIAL_AI_METRICS_STATE = INITIAL_AI_RIGHT_VIEW_STATE;

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

function applyAIChatConfig(state: ChatAIState, chat: ChatAIConfig): ChatAIState {
  const providers = chat.providers ?? [];
  const defaultProvider = providers.find(provider => provider.name === chat.defaultProvider);
  return updateState(state, {
    allowed: chat.allowed,
    enabled: chat.enabled,
    providers,
    defaultProvider: chat.defaultProvider,
    selectedProvider: chat.defaultProvider,
    selectedModel: defaultProvider?.defaultModel || defaultProvider?.models[0]?.name
  });
}

// This Reducer manages the 'ai.chat' portion of Redux Store
export const ChatAiStateReducer = (state: ChatAIState = INITIAL_CHAT_AI_STATE, action: KialiAppAction): ChatAIState => {
  switch (action.type) {
    case getType(ChatAIActions.setAI):
      return applyAIChatConfig(state, action.payload.chat);
    case getType(ChatAIActions.setAIChat):
      return applyAIChatConfig(state, action.payload);
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
    case getType(ChatAIActions.setPendingPrompt): {
      return updateState(state, {
        pendingPrompt: {
          nonce: (state.pendingPrompt?.nonce ?? 0) + 1,
          text: action.payload
        }
      });
    }
    case getType(ChatAIActions.clearPendingPrompt): {
      return updateState(state, { pendingPrompt: undefined });
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

export const AiConsumptionStateReducer = (
  state: AIRightView = INITIAL_AI_RIGHT_VIEW_STATE,
  action: KialiAppAction
): AIRightView => {
  switch (action.type) {
    case getType(ChatAIActions.setAI): {
      const consumption = action.payload.consumption ?? INITIAL_AI_RIGHT_VIEW_STATE;
      return updateState(state, {
        allowed: consumption.allowed,
        enabled: consumption.enabled
      });
    }
    default:
      return state;
  }
};

const withDrawer = (
  state: TroubleshootingAIState,
  drawerExpanded: boolean,
  activeConversationId: string | undefined
): TroubleshootingAIState => {
  if (drawerExpanded === state.drawerExpanded && activeConversationId === state.activeConversationId) {
    const openAnalyses = drawerExpanded && activeConversationId ? 1 : 0;
    if (openAnalyses === state.openAnalyses) {
      return state;
    }
  }
  return updateState(state, {
    activeConversationId,
    drawerExpanded,
    openAnalyses: drawerExpanded && activeConversationId ? 1 : 0
  });
};

const updateConversation = (
  state: TroubleshootingAIState,
  id: string,
  updater: (conversation: TroubleshootingConversation) => TroubleshootingConversation
): TroubleshootingAIState => {
  const conversations = state.conversations ?? [];
  const index = conversations.findIndex(conversation => conversation.id === id);
  if (index < 0) {
    return state;
  }
  const nextConversation = updater(conversations[index]);
  if (nextConversation === conversations[index]) {
    return state;
  }
  const nextConversations = conversations.slice();
  nextConversations[index] = nextConversation;
  return updateState(state, { conversations: nextConversations });
};

export const AiTroubleshootingStateReducer = (
  state: TroubleshootingAIState = INITIAL_TROUBLESHOOTING_STATE,
  action: KialiAppAction
): TroubleshootingAIState => {
  switch (action.type) {
    case getType(ChatAIActions.setAI): {
      const troubleshooting = action.payload.troubleshooting ?? INITIAL_TROUBLESHOOTING_STATE;
      // Hidden ids and conversations are session state, so a config refresh must not clear them.
      return updateState(state, {
        ai_support: {
          allowed: troubleshooting.ai_support?.allowed ?? false,
          enabled: troubleshooting.ai_support?.enabled ?? false
        },
        allowed: troubleshooting.allowed,
        enabled: troubleshooting.enabled
      });
    }
    case getType(ChatAIActions.setTroubleshootingAnalysisOpen): {
      const openAnalyses = action.payload ? 1 : 0;
      if (openAnalyses === state.openAnalyses) {
        return state;
      }
      return updateState(state, { openAnalyses });
    }
    case getType(ChatAIActions.startTroubleshootingConversation): {
      const conversations = state.conversations ?? [];
      const id = `troubleshooting-${conversations.length + 1}`;
      const conversation: TroubleshootingConversation = {
        createdAt: Date.now(),
        description: action.payload.description,
        id,
        messages: [],
        problem: action.payload.problem,
        prompt: action.payload.prompt,
        subProblem: action.payload.subProblem
      };
      return updateState(state, {
        activeConversationId: id,
        conversations: [conversation, ...conversations],
        drawerExpanded: true,
        openAnalyses: 1
      });
    }
    case getType(ChatAIActions.selectTroubleshootingConversation): {
      const conversations = state.conversations ?? [];
      if (!conversations.some(conversation => conversation.id === action.payload)) {
        return state;
      }
      return withDrawer(state, true, action.payload);
    }
    case getType(ChatAIActions.setTroubleshootingDrawerExpanded):
      return withDrawer(state, action.payload, state.activeConversationId);
    case getType(ChatAIActions.toggleTroubleshootingDrawer):
      return withDrawer(state, !state.drawerExpanded, state.activeConversationId);
    case getType(ChatAIActions.addTroubleshootingConversationMessage):
      return updateConversation(state, action.payload.conversationId, conversation => ({
        ...conversation,
        messages: [...conversation.messages, action.payload.message]
      }));
    case getType(ChatAIActions.patchTroubleshootingConversationMessage):
      return updateConversation(state, action.payload.conversationId, conversation => {
        const messages = conversation.messages.map(message =>
          message.id === action.payload.messageId ? { ...message, ...action.payload.patch } : message
        );
        const changed = messages.some((message, index) => message !== conversation.messages[index]);
        return changed ? { ...conversation, messages } : conversation;
      });
    case getType(ChatAIActions.setTroubleshootingBackendConversationId):
      return updateConversation(state, action.payload.conversationId, conversation =>
        conversation.backendConversationId === action.payload.backendConversationId
          ? conversation
          : { ...conversation, backendConversationId: action.payload.backendConversationId }
      );
    case getType(ChatAIActions.finishTroubleshootingConversationStream):
      return updateConversation(state, action.payload, conversation => {
        if (!conversation.messages.some(message => message.working)) {
          return conversation;
        }
        return {
          ...conversation,
          messages: conversation.messages.map(message => (message.working ? { ...message, working: false } : message))
        };
      });
    case getType(ChatAIActions.setTroubleshootingIssues):
      return updateState(state, { error: '', issues: action.payload ?? [], loaded: true });
    case getType(ChatAIActions.setTroubleshootingError):
      return updateState(state, { error: action.payload, loaded: true });
    case getType(ChatAIActions.hideTroubleshootingSubProblem): {
      const hiddenSubProblemIds = state.hiddenSubProblemIds ?? [];
      if (hiddenSubProblemIds.includes(action.payload)) {
        return state;
      }
      return updateState(state, { hiddenSubProblemIds: [...hiddenSubProblemIds, action.payload] });
    }
    case getType(ChatAIActions.showTroubleshootingSubProblem): {
      const hiddenSubProblemIds = state.hiddenSubProblemIds ?? [];
      if (!hiddenSubProblemIds.includes(action.payload)) {
        return state;
      }
      return updateState(state, {
        hiddenSubProblemIds: hiddenSubProblemIds.filter(id => id !== action.payload)
      });
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
    case getType(ChatAIActions.setAI):
      return action.payload.enabled;
    case getType(ChatAIActions.setAIChat):
      return action.payload.enabled;
    default:
      return state;
  }
};

// This Reducer allows changes to the 'ai' portion of Redux Store
export const AiStateReducer = combineReducers<AIState, KialiAppAction>({
  chat: ChatAiStateReducer,
  consumption: AiConsumptionStateReducer,
  enabled: AiEnabledReducer,
  troubleshooting: AiTroubleshootingStateReducer
});
