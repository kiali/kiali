// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { ChatAIConfig, ContextRequest } from 'types/Chatbot';

export const setChatAI = createStandardAction(ActionKeys.CHAT_AI_SET_CHAT_AI)<ChatAIConfig>();
export const setContext = createStandardAction(ActionKeys.CHAT_AI_SET_CONTEXT)<ContextRequest>();
export const setConversationID = createStandardAction(ActionKeys.CHAT_AI_SET_CONVERSATION_ID)<{ id: string }>();


export const ChatAIActions = {
  setChatAI,
  setContext,
  setConversationID
};

export type ChatAIAction = ActionType<typeof ChatAIActions>;
