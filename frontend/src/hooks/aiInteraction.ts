import * as React from 'react';
import { ChatAIActions } from '../actions/ChatAIActions';
import { isKiosk } from '../components/Kiosk/KioskActions';
import type { PendingChatPrompt } from '../types/Chatbot';
import { t } from '../utils/I18nUtils';
import { useKialiDispatch, useKialiSelector } from './redux';

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
  chatAllowed: boolean;
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

export const useAIInteraction = (): AIInteractionResult => {
  const dispatch = useKialiDispatch();

  // Same gates that mount the chatbot and let this user send messages.
  const chatAllowed = useKialiSelector(state =>
    Boolean(
      state.ai?.enabled && state.ai?.chat?.enabled && state.ai?.chat?.allowed && !isKiosk(state.globalState?.kiosk)
    )
  );

  const canSendPrompt = React.useCallback(
    (prompt?: string): boolean => chatAllowed && Boolean(prompt && prompt.trim() !== ''),
    [chatAllowed]
  );

  const openChat = React.useCallback((): void => {
    if (!chatAllowed) {
      return;
    }
    dispatch(ChatAIActions.setChatVisible(true));
  }, [chatAllowed, dispatch]);

  const sendPrompt = React.useCallback(
    (request: PendingChatPrompt | string): void => {
      const payload = typeof request === 'string' ? { text: request } : request;
      if (!canSendPrompt(payload.text)) {
        return;
      }
      dispatch(ChatAIActions.setPendingPrompt(request));
    },
    [canSendPrompt, dispatch]
  );

  const askChat = React.useCallback(
    (prompt: string): void => {
      if (!canSendPrompt(prompt)) {
        return;
      }
      dispatch(ChatAIActions.setPendingPrompt({ interactionMode: 'ask', text: prompt }));
    },
    [canSendPrompt, dispatch]
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
      dispatch(
        ChatAIActions.setPendingPrompt({
          interactionMode: 'troubleshoot',
          ...(intro ? { intro } : {}),
          text
        })
      );
    },
    [canSendPrompt, dispatch]
  );

  return {
    askChat,
    canSendPrompt,
    chatAllowed,
    openChat,
    sendPrompt,
    troubleshoot
  };
};
