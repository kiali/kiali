/** Custom event fired when an AI chatbot response stream completes. */
export const AI_RESPONSE_RECEIVED_EVENT = 'kiali:ai-response-received';

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
