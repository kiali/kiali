import { ExtendedMessage } from 'types/Chatbot';

const STORAGE_PREFIX = 'kiali_chat_conversation_';
const USE_SESSION_STORAGE = true; // Set to false to use localStorage instead

/**
 * Get the storage object (sessionStorage or localStorage)
 */
const getStorage = (): Storage => {
  return USE_SESSION_STORAGE ? sessionStorage : localStorage;
};

/**
 * Save a conversation to storage by conversationID
 */
export const saveConversation = (conversationId: string, messages: ExtendedMessage[]): void => {
  try {
    const storage = getStorage();
    const key = `${STORAGE_PREFIX}${conversationId}`;
    storage.setItem(key, JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save conversation to storage:', error);
  }
};

/**
 * Load a conversation from storage by conversationID
 */
export const loadConversation = (conversationId: string): ExtendedMessage[] | null => {
  try {
    const storage = getStorage();
    const key = `${STORAGE_PREFIX}${conversationId}`;
    const data = storage.getItem(key);
    if (data) {
      return JSON.parse(data) as ExtendedMessage[];
    }
  } catch (error) {
    console.error('Failed to load conversation from storage:', error);
  }
  return null;
};

/**
 * Load all conversations from storage that match the provided conversationIDs
 */
export const loadConversations = (conversationIds: string[]): Map<string, ExtendedMessage[]> => {
  const conversations = new Map<string, ExtendedMessage[]>();
  conversationIds.forEach(id => {
    const messages = loadConversation(id);
    if (messages) {
      conversations.set(id, messages);
    }
  });
  return conversations;
};

/**
 * Remove a conversation from storage by conversationID
 */
export const removeConversation = (conversationId: string): void => {
  try {
    const storage = getStorage();
    const key = `${STORAGE_PREFIX}${conversationId}`;
    storage.removeItem(key);
  } catch (error) {
    console.error('Failed to remove conversation from storage:', error);
  }
};

/**
 * Clear all conversation storage
 */
export const clearAllConversations = (): void => {
  try {
    const storage = getStorage();
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(key => storage.removeItem(key));
  } catch (error) {
    console.error('Failed to clear conversations from storage:', error);
  }
};

/**
 * Get all conversation IDs stored in storage
 */
export const getAllStoredConversationIds = (): string[] => {
  const ids: string[] = [];
  try {
    const storage = getStorage();
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const id = key.replace(STORAGE_PREFIX, '');
        ids.push(id);
      }
    }
  } catch (error) {
    console.error('Failed to get stored conversation IDs:', error);
  }
  return ids;
};
