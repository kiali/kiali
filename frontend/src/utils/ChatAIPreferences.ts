import { KIALI_CHAT_ALWAYS_NAVIGATE, KIALI_CHAT_REVIEW_PROMPT_BEFORE_SEND } from 'types/Common';

export const readAlwaysNavigatePreference = (): boolean => localStorage.getItem(KIALI_CHAT_ALWAYS_NAVIGATE) === 'true';

export const persistAlwaysNavigatePreference = (alwaysNavigate: boolean): void => {
  localStorage.setItem(KIALI_CHAT_ALWAYS_NAVIGATE, String(alwaysNavigate));
};

export const readReviewPromptBeforeSendPreference = (): boolean =>
  localStorage.getItem(KIALI_CHAT_REVIEW_PROMPT_BEFORE_SEND) === 'true';

export const persistReviewPromptBeforeSendPreference = (reviewPromptBeforeSend: boolean): void => {
  localStorage.setItem(KIALI_CHAT_REVIEW_PROMPT_BEFORE_SEND, String(reviewPromptBeforeSend));
};
