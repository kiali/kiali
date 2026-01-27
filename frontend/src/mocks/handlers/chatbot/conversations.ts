import { ChatResponse } from '../../../types/Chatbot';
import { conversationModuleEntries } from './conversations.index';

const normalizeConversationModule = (module: unknown): Partial<ChatResponse> => {
  if (typeof module === 'string') {
    return { answer: module };
  }
  if (module && typeof module === 'object' && 'default' in (module as { default?: unknown })) {
    const payload = (module as { default?: unknown }).default;
    return typeof payload === 'string' ? { answer: payload } : (payload as Partial<ChatResponse>) ?? {};
  }
  return (module as Partial<ChatResponse>) ?? {};
};

export const conversationEntries = new Map<string, Partial<ChatResponse>>(
  conversationModuleEntries.map(([id, module]) => [id, normalizeConversationModule(module)])
);

export const conversationEntryIds = Array.from(conversationEntries.keys());
