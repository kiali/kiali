import { useKialiSelector } from 'hooks/redux';

export const useChatAIEnabled = (): boolean => useKialiSelector(state => state.ai.enabled && state.ai.chat.enabled);
