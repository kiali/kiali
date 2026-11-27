import * as React from 'react';
import { ChatAIActions } from '../actions/ChatAIActions';
import { isKiosk } from '../components/Kiosk/KioskActions';
import type { PendingChatPrompt } from '../types/Chatbot';
import { t } from '../utils/I18nUtils';
import { isOSSMC } from '../utils/NavigationUtils';
import { useKialiDispatch, useKialiSelector } from './redux';

/** Lightspeed/OLS attachment payload. Kept compatible with OpenShift Console OLS. */
export type AIChatAttachment = {
  attachmentType: string;
  id?: string;
  isEditable?: boolean;
  kind: string;
  name: string;
  namespace: string;
  originalValue?: string;
  ownerName?: string;
  value: string;
};

/**
 * Opens an external chat (Kiali chatbot replacement such as OpenShift Lightspeed).
 * Argument order matches the OLS `openOLS` provider.
 */
export type OpenAIChatFn = (
  prompt?: string,
  attachments?: AIChatAttachment[],
  submitImmediately?: boolean,
  hidePrompt?: boolean
) => void;

/** Lightspeed extension provider — a React hook that returns openAIChat. */
export type UseOpenAIChat = () => OpenAIChatFn;

export const AIChatContext = React.createContext<OpenAIChatFn | undefined>(undefined);

export type TroubleshootInteractionRequest = {
  context?: string;
  description?: string;
  intro?: string;
  problem?: string;
  prompt: string;
};

export type AIInteractionResult = {
  askChat: (prompt: string) => void;
  canSendPrompt: (prompt?: string) => boolean;
  /** Feature is on and this user may send messages (not kiosk). */
  chatAllowed: boolean;
  /** AI chat feature is configured on (ignores user permission / kiosk). */
  chatEnabled: boolean;
  openChat: () => void;
  sendPrompt: (request: PendingChatPrompt | string) => void;
  troubleshoot: (request: TroubleshootInteractionRequest | string) => void;
};

export const buildTroubleshootIntro = (problem?: string, description?: string): string => {
  const heading = problem?.trim() ? problem : t('Troubleshooting');
  return description
    ? t('We are going to try to fix {{problem}}: {{description}}.', { description, problem: heading })
    : t('We are going to try to fix {{problem}}.', { problem: heading });
};

const promptText = (request: PendingChatPrompt | string): string =>
  typeof request === 'string' ? request : request.text;

export const useAIInteraction = (openAIChat?: OpenAIChatFn): AIInteractionResult => {
  const dispatch = useKialiDispatch();
  const contextChat = React.useContext(AIChatContext);
  const externalChat = openAIChat ?? contextChat;

  // Same gate used to mount the chatbot shell (ai + chat feature flags).
  const kialiChatEnabled = useKialiSelector(state => Boolean(state.ai?.enabled && state.ai?.chat?.enabled));

  // Same gates that let this user open the panel and send messages.
  const kialiChatAllowed = useKialiSelector(state =>
    Boolean(
      state.ai?.enabled && state.ai?.chat?.enabled && state.ai?.chat?.allowed && !isKiosk(state.globalState?.kiosk)
    )
  );
  const reviewPromptBeforeSend = useKialiSelector(state => Boolean(state.ai?.chat?.reviewPromptBeforeSend));

  // OSSMC has no Kiali chatbot: Ask / Fix follow openAIChat only (Lightspeed).
  // Standalone Kiali uses the AI chat configuration.
  const chatEnabled = isOSSMC() ? Boolean(externalChat) : kialiChatEnabled;
  const chatAllowed = isOSSMC() ? Boolean(externalChat) : kialiChatAllowed;

  const canSendPrompt = React.useCallback(
    (prompt?: string): boolean => chatAllowed && Boolean(prompt && prompt.trim() !== ''),
    [chatAllowed]
  );

  const openExternalChat = React.useCallback(
    (prompt?: string): void => {
      if (!externalChat) {
        return;
      }
      if (prompt === undefined) {
        externalChat();
        return;
      }
      // Third arg is submitImmediately; false leaves the prompt in the OLS input for review.
      externalChat(prompt, undefined, !reviewPromptBeforeSend);
    },
    [externalChat, reviewPromptBeforeSend]
  );

  const openChat = React.useCallback((): void => {
    if (externalChat) {
      openExternalChat();
      return;
    }
    if (!chatAllowed) {
      return;
    }
    dispatch(ChatAIActions.setChatVisible(true));
  }, [chatAllowed, dispatch, externalChat, openExternalChat]);

  const sendPrompt = React.useCallback(
    (request: PendingChatPrompt | string): void => {
      const text = promptText(request);
      if (!canSendPrompt(text)) {
        return;
      }
      if (externalChat) {
        openExternalChat(text);
        return;
      }
      dispatch(ChatAIActions.setPendingPrompt(request));
    },
    [canSendPrompt, dispatch, externalChat, openExternalChat]
  );

  const askChat = React.useCallback(
    (prompt: string): void => {
      if (!canSendPrompt(prompt)) {
        return;
      }
      if (externalChat) {
        openExternalChat(prompt);
        return;
      }
      dispatch(ChatAIActions.setPendingPrompt({ interactionMode: 'ask', text: prompt }));
    },
    [canSendPrompt, dispatch, externalChat, openExternalChat]
  );

  const troubleshoot = React.useCallback(
    (options: TroubleshootInteractionRequest | string): void => {
      const request: TroubleshootInteractionRequest = typeof options === 'string' ? { prompt: options } : options;
      const text = request.context ? `${request.context}\n\n${request.prompt}` : request.prompt;
      if (!canSendPrompt(text)) {
        return;
      }
      const intro =
        request.intro ??
        (request.problem !== undefined || request.description !== undefined
          ? buildTroubleshootIntro(request.problem, request.description)
          : undefined);
      if (externalChat) {
        openExternalChat(intro ? `${intro}\n\n${text}` : text);
        return;
      }
      dispatch(
        ChatAIActions.setPendingPrompt({
          interactionMode: 'troubleshoot',
          ...(intro ? { intro } : {}),
          text
        })
      );
    },
    [canSendPrompt, dispatch, externalChat, openExternalChat]
  );

  return {
    askChat,
    canSendPrompt,
    chatAllowed,
    chatEnabled,
    openChat,
    sendPrompt,
    troubleshoot
  };
};
