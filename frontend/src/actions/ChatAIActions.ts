// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { ChatAIConfig, ContextRequest } from 'types/Chatbot';

export const ChatAIActions = {
  setChatAI: createStandardAction(ActionKeys.CHAT_AI_SET_CHAT_AI)<ChatAIConfig>(),
  setContext: createStandardAction(ActionKeys.CHAT_AI_SET_CONTEXT)<ContextRequest>()
};

export type ChatAIAction = ActionType<typeof ChatAIActions>;
