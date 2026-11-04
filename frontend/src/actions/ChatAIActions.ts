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
  PendingChatPrompt,
  Tool,
  TroubleshootingIssue
} from 'types/Chatbot';

export const setAI = createStandardAction(ActionKeys.CHAT_AI_SET_AI)<AIConfig>();
export const setAIChat = createStandardAction(ActionKeys.CHAT_AI_SET_AI_CHAT)<ChatAIConfig>();
export const setConversationID = createStandardAction(ActionKeys.CHAT_AI_SET_CONVERSATION_ID)<{
  id: string | undefined;
}>();
export const setSelectedProvider = createStandardAction(ActionKeys.CHAT_AI_SET_SELECTED_PROVIDER)<{
  provider: string;
}>();
export const setSelectedModel = createStandardAction(ActionKeys.CHAT_AI_SET_SELECTED_MODEL)<{ model: string }>();
export const setChatbotVisible = createStandardAction(ActionKeys.CHAT_AI_SET_CHATBOT_VISIBLE)<{
  visible: boolean;
}>();
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
export const setChatContext = createStandardAction(ActionKeys.CHAT_AI_SET_CONTEXT)<string>();
export const setPendingPrompt = createStandardAction(ActionKeys.CHAT_AI_SET_PENDING_PROMPT)<
  PendingChatPrompt | string
>();
export const setChatVisible = createStandardAction(ActionKeys.CHAT_AI_SET_VISIBLE)<boolean>();
export const clearPendingPrompt = createStandardAction(ActionKeys.CHAT_AI_CLEAR_PENDING_PROMPT)();
export const setOpenTool = createStandardAction(ActionKeys.CHAT_AI_SET_OPEN_TOOL)<{
  chatEntryIndex: number;
  id: string;
}>();
export const clearOpenTool = createStandardAction(ActionKeys.CHAT_AI_CLEAR_OPEN_TOOL)();
export const setAlwaysNavigate = createStandardAction(ActionKeys.CHAT_AI_SET_ALWAYS_NAVIGATE)<{
  alwaysNavigate: boolean;
}>();
export const setInteractionMode = createStandardAction(ActionKeys.CHAT_AI_SET_INTERACTION_MODE)<{
  interactionMode: ChatInteractionMode;
}>();
export const setResourceHealth = createStandardAction(ActionKeys.CHAT_AI_SET_RESOURCE_HEALTH)<ChatResourceHealth>();
export const clearResourceHealth = createStandardAction(ActionKeys.CHAT_AI_CLEAR_RESOURCE_HEALTH)();
export type TroubleshootingIssueVisibilityPayload = {
  id: string;
  subProblemIds: string[];
};

export const hideTroubleshootingIssue = createStandardAction(
  ActionKeys.CHAT_AI_HIDE_TROUBLESHOOTING_ISSUE
)<TroubleshootingIssueVisibilityPayload>();
export const hideTroubleshootingSubProblem = createStandardAction(
  ActionKeys.CHAT_AI_HIDE_TROUBLESHOOTING_SUBPROBLEM
)<string>();
export const setTroubleshootingError = createStandardAction(ActionKeys.CHAT_AI_SET_TROUBLESHOOTING_ERROR)<string>();
export const setTroubleshootingIssues = createStandardAction(ActionKeys.CHAT_AI_SET_TROUBLESHOOTING_ISSUES)<
  TroubleshootingIssue[]
>();
export const showTroubleshootingIssue = createStandardAction(
  ActionKeys.CHAT_AI_SHOW_TROUBLESHOOTING_ISSUE
)<TroubleshootingIssueVisibilityPayload>();
export const showTroubleshootingSubProblem = createStandardAction(
  ActionKeys.CHAT_AI_SHOW_TROUBLESHOOTING_SUBPROBLEM
)<string>();

export const ChatAIActions = {
  setAI,
  setAIChat,
  setAlwaysNavigate,
  setInteractionMode,
  setChatContext,
  setQuery,
  setChatbotVisible,
  setPendingPrompt,
  setChatVisible,
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
  setResourceHealth,
  clearResourceHealth,
  hideTroubleshootingIssue,
  hideTroubleshootingSubProblem,
  setTroubleshootingError,
  setTroubleshootingIssues,
  showTroubleshootingIssue,
  showTroubleshootingSubProblem
};

export type ChatAIAction = ActionType<typeof ChatAIActions>;
