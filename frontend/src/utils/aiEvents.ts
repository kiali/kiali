/** Custom event fired when an AI chatbot response stream completes. */
export const AI_RESPONSE_RECEIVED_EVENT = 'kiali:ai-response-received';

/** Custom event to open the AI chat panel and focus the prompt. */
export const AI_OPEN_CHAT_EVENT = 'kiali:ai-open-chat';

/** Dispatch the event — call this when the chatbot stream fully closes. */
export const dispatchAIResponseReceived = (): void => {
  window.dispatchEvent(new CustomEvent(AI_RESPONSE_RECEIVED_EVENT));
};

/**
 * Subscribe to AI response completion events.
 * Returns an unsubscribe function suitable for use in useEffect cleanup.
 */
export const onAIResponseReceived = (handler: () => void): (() => void) => {
  window.addEventListener(AI_RESPONSE_RECEIVED_EVENT, handler);
  return () => window.removeEventListener(AI_RESPONSE_RECEIVED_EVENT, handler);
};

/** Open the AI chatbot panel (e.g. from a contextual "Ask AI" action elsewhere in the UI). */
export const dispatchOpenAIChat = (): void => {
  window.dispatchEvent(new CustomEvent(AI_OPEN_CHAT_EVENT));
};

export const onOpenAIChat = (handler: () => void): (() => void) => {
  window.addEventListener(AI_OPEN_CHAT_EVENT, handler);
  return () => window.removeEventListener(AI_OPEN_CHAT_EVENT, handler);
};
