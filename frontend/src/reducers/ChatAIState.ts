import { combineReducers } from 'redux';
import type { AIRightView, AIState, ChatAIState, TroubleshootingAIState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import type { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { ChatAIActions } from 'actions/ChatAIActions';
import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import type { ChatAIConfig } from 'types/Chatbot';
import { readHiddenSubProblemIds } from 'utils/TroubleshootingStorage';

export const INITIAL_AI_RIGHT_VIEW_STATE: AIRightView = {
  allowed: false,
  enabled: false
};

export const INITIAL_TROUBLESHOOTING_STATE: TroubleshootingAIState = {
  error: '',
  hiddenSubProblemIds: readHiddenSubProblemIds(),
  issues: [],
  loaded: false
};

export const INITIAL_CHAT_AI_STATE: ChatAIState = {
  allowed: false,
  alwaysNavigate: false,
  chatContext: '',
  chatHistory: ImmutableList(),
  conversationID: '',
  defaultProvider: '',
  enabled: false,
  interactionMode: 'ask',
  openTool: ImmutableMap({ chatEntryIndex: null, id: null }),
  providers: [],
  query: '',
  resourceHealth: undefined,
  selectedModel: '',
  selectedProvider: '',
  visible: false
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
    case getType(ChatAIActions.setChatbotVisible): {
      return updateState(state, { visible: action.payload.visible });
    }
    case getType(ChatAIActions.setChatHistoryClear): {
      return updateState(state, { chatHistory: ImmutableList(), chatContext: '' });
    }
    case getType(ChatAIActions.setChatContext): {
      return updateState(state, { chatContext: action.payload });
    }
    case getType(ChatAIActions.setChatHistoryAdd): {
      const history = state.chatHistory.push(ImmutableMap(action.payload.entry));
      return updateState(state, { chatHistory: history });
    }
    case getType(ChatAIActions.setQuery): {
      return updateState(state, { query: action.payload });
    }
    case getType(ChatAIActions.setPendingPrompt): {
      const request = typeof action.payload === 'string' ? { text: action.payload } : action.payload;
      return updateState(state, {
        pendingPrompt: {
          ...(request.interactionMode ? { interactionMode: request.interactionMode } : {}),
          ...(request.intro ? { intro: request.intro } : {}),
          nonce: (state.pendingPrompt?.nonce ?? 0) + 1,
          text: request.text
        },
        visible: true
      });
    }
    case getType(ChatAIActions.setChatVisible): {
      return updateState(state, { visible: action.payload });
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

const visibilityIds = (id: string, subProblemIds: readonly string[]): string[] =>
  [id, ...subProblemIds].filter(hiddenId => hiddenId.length > 0);

const nextHiddenIds = (current: readonly string[], ids: readonly string[], hide: boolean): string[] | undefined => {
  const hidden = new Set(current);
  let changed = false;
  ids.forEach(id => {
    if (hide) {
      if (!hidden.has(id)) {
        hidden.add(id);
        changed = true;
      }
      return;
    }
    if (hidden.delete(id)) {
      changed = true;
    }
  });
  return changed ? Array.from(hidden) : undefined;
};

export const AiTroubleshootingStateReducer = (
  state: TroubleshootingAIState = INITIAL_TROUBLESHOOTING_STATE,
  action: KialiAppAction
): TroubleshootingAIState => {
  switch (action.type) {
    case getType(ChatAIActions.setTroubleshootingIssues):
      return updateState(state, { error: '', issues: action.payload ?? [], loaded: true });
    case getType(ChatAIActions.setTroubleshootingError):
      return updateState(state, { error: action.payload, loaded: true });
    case getType(ChatAIActions.hideTroubleshootingIssue): {
      const hiddenSubProblemIds = nextHiddenIds(
        state.hiddenSubProblemIds ?? [],
        visibilityIds(action.payload.id, action.payload.subProblemIds),
        true
      );
      return hiddenSubProblemIds ? updateState(state, { hiddenSubProblemIds }) : state;
    }
    case getType(ChatAIActions.hideTroubleshootingSubProblem): {
      const hiddenSubProblemIds = state.hiddenSubProblemIds ?? [];
      if (hiddenSubProblemIds.includes(action.payload)) {
        return state;
      }
      return updateState(state, { hiddenSubProblemIds: [...hiddenSubProblemIds, action.payload] });
    }
    case getType(ChatAIActions.showTroubleshootingIssue): {
      const hiddenSubProblemIds = nextHiddenIds(
        state.hiddenSubProblemIds ?? [],
        visibilityIds(action.payload.id, action.payload.subProblemIds),
        false
      );
      return hiddenSubProblemIds ? updateState(state, { hiddenSubProblemIds }) : state;
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

// Top-level AI master switch. Independent from chat.enabled / consumption.enabled.
const AiEnabledReducer = (state: boolean = INITIAL_AI_ENABLED_STATE, action: KialiAppAction): boolean => {
  switch (action.type) {
    case getType(ChatAIActions.setAI):
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
