// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { ChatAIConfig, ChatEntry, ChatInteractionMode, Tool } from 'types/Chatbot';
import { ChatbotDisplayMode } from '@patternfly/chatbot';

export const setChatAI = createStandardAction(ActionKeys.CHAT_AI_SET_CHAT_AI)<ChatAIConfig>();
export const setConversationID = createStandardAction(ActionKeys.CHAT_AI_SET_CONVERSATION_ID)<{
  id: string | undefined;
}>();
export const setSelectedProvider = createStandardAction(ActionKeys.CHAT_AI_SET_SELECTED_PROVIDER)<{
  provider: string;
}>();
export const setSelectedModel = createStandardAction(ActionKeys.CHAT_AI_SET_SELECTED_MODEL)<{ model: string }>();
export const setChatHistoryClear = createStandardAction(ActionKeys.CHAT_AI_SET_CHAT_HISTORY_CLEAR)();
export const setChatHistoryAdd = createStandardAction(ActionKeys.CHAT_AI_SET_CHAT_HISTORY_ADD)<{ entry: ChatEntry }>();
export const setChatHistoryUpdateById = createStandardAction(ActionKeys.CHAT_AI_SET_CHAT_HISTORY_UPDATE_BY_ID)<{
  entry: Partial<ChatEntry>;
  id: string;
}>();
export const setChatHistoryUpdateTool = createStandardAction(ActionKeys.CHAT_AI_SET_CHAT_HISTORY_UPDATE_TOOL)<{
  id: string;
  tool: Partial<Tool>;
  toolID: string;
}>();
export const setQuery = createStandardAction(ActionKeys.CHAT_AI_SET_QUERY)<string>();
export const setOpenTool = createStandardAction(ActionKeys.CHAT_AI_SET_OPEN_TOOL)<{
  chatEntryIndex: number;
  id: string;
}>();
export const clearOpenTool = createStandardAction(ActionKeys.CHAT_AI_CLEAR_OPEN_TOOL)();
export const setDisplayMode = createStandardAction(ActionKeys.CHAT_AI_SET_DISPLAY_MODE)<{
  displayMode: ChatbotDisplayMode;
}>();
export const setAlwaysNavigate = createStandardAction(ActionKeys.CHAT_AI_SET_ALWAYS_NAVIGATE)<{
  alwaysNavigate: boolean;
}>();
export const setInteractionMode = createStandardAction(ActionKeys.CHAT_AI_SET_INTERACTION_MODE)<{
  interactionMode: ChatInteractionMode;
}>();

export const ChatAIActions = {
  setChatAI,
  setAlwaysNavigate,
  setInteractionMode,
  setQuery,
  setChatHistoryClear,
  setChatHistoryAdd,
  setChatHistoryUpdateById,
  setChatHistoryUpdateTool,
  setConversationID,
  setSelectedProvider,
  setSelectedModel,
  setOpenTool,
  clearOpenTool,
  setDisplayMode
};

export type ChatAIAction = ActionType<typeof ChatAIActions>;
