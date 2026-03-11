// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { ChatAIConfig, ChatEntry, ContextRequest, Tool } from 'types/Chatbot';
import { ChatbotDisplayMode } from '@patternfly/chatbot';


export const setChatAI = createStandardAction(ActionKeys.CHAT_AI_SET_CHAT_AI)<ChatAIConfig>();
export const setContext = createStandardAction(ActionKeys.CHAT_AI_SET_CONTEXT)<ContextRequest>();
export const setDisplayMode = createStandardAction(ActionKeys.CHAT_AI_SET_DISPLAY_MODE)<ChatbotDisplayMode>();

export const chatHistoryClear = createStandardAction(ActionKeys.CHAT_AI_CHAT_HISTORY_CLEAR)();

export const chatHistoryPush = createStandardAction(ActionKeys.CHAT_AI_CHAT_HISTORY_PUSH)<{ entry: ChatEntry }>();

export const chatHistoryUpdateByID = createStandardAction(ActionKeys.CHAT_AI_CHAT_HISTORY_UPDATE_BY_ID)<{ id: string, entry: Partial<ChatEntry> }>();

export const chatHistoryUpdateTool = createStandardAction(ActionKeys.CHAT_AI_CHAT_HISTORY_UPDATE_TOOL)<{ id: string, toolID: string, tool: Partial<Tool> }>();

export const chatOpenToolSet = createStandardAction(ActionKeys.CHAT_AI_OPEN_TOOL_SET)<{ chatEntryIndex: string, id: string }>();

export const chatOpenToolClear = createStandardAction(ActionKeys.CHAT_AI_OPEN_TOOL_CLEAR)();

export const chatSetConversationID = createStandardAction(ActionKeys.CHAT_AI_SET_CONVERSATION_ID)<{ id: string }>();

export const chatSetQuery = createStandardAction(ActionKeys.CHAT_AI_SET_QUERY)<{ query: string }>();

export const ChatAISettingsActions = {
  setChatAI,
  setContext,
  setDisplayMode
};


export const ChatAIActions = {
  setChatAI,
  setContext,
  chatHistoryClear,
  chatHistoryPush,
  chatHistoryUpdateByID,
  chatHistoryUpdateTool,
  chatOpenToolSet,
  chatOpenToolClear,
  chatSetConversationID,
  chatSetQuery,
};


export type ChatAISettingsActions = ActionType<typeof ChatAISettingsActions>;
export type ChatAIAction = ActionType<typeof ChatAIActions>;
