// Action Creators allow us to create typesafe utilities for dispatching actions
import { createStandardAction } from 'typesafe-actions';
import type { ActionType } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import type {
  AIConfig,
  ChatAIConfig,
  ChatEntry,
  ChatInteractionMode,
  ChatResourceHealth,
  StartTroubleshootingConversationPayload,
  Tool,
  TroubleshootingConversationMessage,
  TroubleshootingConversationMessagePatch,
  TroubleshootingIssue
} from 'types/Chatbot';
import type { ChatbotDisplayMode } from '@patternfly/chatbot';

export const setAI = createStandardAction(ActionKeys.CHAT_AI_SET_AI)<AIConfig>();
export const setAIChat = createStandardAction(ActionKeys.CHAT_AI_SET_AI_CHAT)<ChatAIConfig>();
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
export const setPendingPrompt = createStandardAction(ActionKeys.CHAT_AI_SET_PENDING_PROMPT)<string>();
export const clearPendingPrompt = createStandardAction(ActionKeys.CHAT_AI_CLEAR_PENDING_PROMPT)();
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
export const setResourceHealth = createStandardAction(ActionKeys.CHAT_AI_SET_RESOURCE_HEALTH)<ChatResourceHealth>();
export const clearResourceHealth = createStandardAction(ActionKeys.CHAT_AI_CLEAR_RESOURCE_HEALTH)();
export const addTroubleshootingConversationMessage = createStandardAction(
  ActionKeys.CHAT_AI_ADD_TROUBLESHOOTING_CONVERSATION_MESSAGE
)<{
  conversationId: string;
  message: TroubleshootingConversationMessage;
}>();
export const finishTroubleshootingConversationStream = createStandardAction(
  ActionKeys.CHAT_AI_FINISH_TROUBLESHOOTING_CONVERSATION_STREAM
)<string>();
export const hideTroubleshootingSubProblem = createStandardAction(
  ActionKeys.CHAT_AI_HIDE_TROUBLESHOOTING_SUBPROBLEM
)<string>();
export const patchTroubleshootingConversationMessage = createStandardAction(
  ActionKeys.CHAT_AI_PATCH_TROUBLESHOOTING_CONVERSATION_MESSAGE
)<{
  conversationId: string;
  messageId: number;
  patch: TroubleshootingConversationMessagePatch;
}>();
export const selectTroubleshootingConversation = createStandardAction(
  ActionKeys.CHAT_AI_SELECT_TROUBLESHOOTING_CONVERSATION
)<string>();
// True while the troubleshooting drawer is showing a conversation. Refresh waits until this is false.
export const setTroubleshootingAnalysisOpen = createStandardAction(
  ActionKeys.CHAT_AI_SET_TROUBLESHOOTING_ANALYSIS_OPEN
)<boolean>();
export const setTroubleshootingBackendConversationId = createStandardAction(
  ActionKeys.CHAT_AI_SET_TROUBLESHOOTING_BACKEND_CONVERSATION_ID
)<{
  backendConversationId: string;
  conversationId: string;
}>();
export const setTroubleshootingDrawerExpanded = createStandardAction(
  ActionKeys.CHAT_AI_SET_TROUBLESHOOTING_DRAWER_EXPANDED
)<boolean>();
export const setTroubleshootingError = createStandardAction(ActionKeys.CHAT_AI_SET_TROUBLESHOOTING_ERROR)<string>();
export const setTroubleshootingIssues = createStandardAction(ActionKeys.CHAT_AI_SET_TROUBLESHOOTING_ISSUES)<
  TroubleshootingIssue[]
>();
export const showTroubleshootingSubProblem = createStandardAction(
  ActionKeys.CHAT_AI_SHOW_TROUBLESHOOTING_SUBPROBLEM
)<string>();
export const startTroubleshootingConversation = createStandardAction(
  ActionKeys.CHAT_AI_START_TROUBLESHOOTING_CONVERSATION
)<StartTroubleshootingConversationPayload>();
export const toggleTroubleshootingDrawer = createStandardAction(ActionKeys.CHAT_AI_TOGGLE_TROUBLESHOOTING_DRAWER)();

export const ChatAIActions = {
  setAI,
  setAIChat,
  setAlwaysNavigate,
  setInteractionMode,
  setQuery,
  setPendingPrompt,
  clearPendingPrompt,
  setChatHistoryClear,
  setChatHistoryAdd,
  setChatHistoryUpdateById,
  setChatHistoryUpdateTool,
  setConversationID,
  setSelectedProvider,
  setSelectedModel,
  setOpenTool,
  clearOpenTool,
  setDisplayMode,
  setResourceHealth,
  clearResourceHealth,
  addTroubleshootingConversationMessage,
  finishTroubleshootingConversationStream,
  hideTroubleshootingSubProblem,
  patchTroubleshootingConversationMessage,
  selectTroubleshootingConversation,
  setTroubleshootingAnalysisOpen,
  setTroubleshootingBackendConversationId,
  setTroubleshootingDrawerExpanded,
  setTroubleshootingError,
  setTroubleshootingIssues,
  showTroubleshootingSubProblem,
  startTroubleshootingConversation,
  toggleTroubleshootingDrawer
};

export type ChatAIAction = ActionType<typeof ChatAIActions>;
