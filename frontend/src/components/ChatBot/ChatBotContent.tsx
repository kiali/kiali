import React, { useEffect, useRef, useState } from 'react';
import { Map as ImmutableMap, List as ImmutableList } from 'immutable';
import { ChatbotContent, ChatbotWelcomePrompt, MessageBox } from '@patternfly/chatbot';
import type { WelcomePrompt } from '@patternfly/chatbot/dist/esm/ChatbotWelcomePrompt/ChatbotWelcomePrompt';
import { t } from 'utils/I18nUtils';
import { DataPrompts } from './DataPrompts';
import { useLocation } from 'react-router-dom-v5-compat';
import { useDispatch, useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { EntryChat } from './EntryChat/EntryChat';
import { ChatAIActions } from 'actions/ChatAIActions';
import * as API from 'services/Api';
import { Prompt } from 'types/Chatbot';

type ChatBotContentProps = {
  chatHistoryEndRef: React.RefObject<HTMLDivElement>;
};

const toWelcomePrompt = (prompt: Prompt, dispatch: ReturnType<typeof useDispatch>): WelcomePrompt => ({
  title: prompt.title,
  message: prompt.description ?? prompt.message,
  onClick: () => dispatch(ChatAIActions.setQuery(prompt.query))
});

const deriveCategory = (pathname: string): string => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'namespaces' && segments.length >= 3) {
    return segments[2];
  }
  if (segments[0] === 'graph' && segments[1] === 'node') {
    return 'graph';
  }
  return segments[0] || 'overview';
};

export const ChatBotContent: React.FC<ChatBotContentProps> = ({ chatHistoryEndRef }) => {
  const { pathname } = useLocation();
  const category = deriveCategory(pathname);
  const [promptData, setPromptData] = useState<WelcomePrompt[]>([]);
  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector(
    (s: KialiAppState) => s.aiChat.chatHistory
  );
  const username = useSelector((state: KialiAppState) => state.authentication.session?.username ?? '');
  const dispatch = useDispatch();

  // Snapshot chat history size when the user navigates to a different page category.
  // Used to decide whether the welcome prompt should appear below existing messages
  // (when the user just arrived on this page) or at the top (initial state or after
  // the user has sent new messages on this page).
  const historySizeOnEnterRef = useRef(0);
  const prevCategoryRef = useRef(category);

  if (prevCategoryRef.current !== category) {
    historySizeOnEnterRef.current = chatHistory.size;
    prevCategoryRef.current = category;
  }

  // Show prompt at the bottom only when the user just navigated here with pre-existing
  // history and hasn't added new messages yet. Once new messages are sent (size grows
  // beyond the snapshot), the prompt moves back to the top.
  const showAtBottom = historySizeOnEnterRef.current > 0 && chatHistory.size === historySizeOnEnterRef.current;

  useEffect(() => {
    let cancelled = false;
    API.getChatPrompts(category)
      .then(response => {
        if (cancelled) {
          return;
        }
        const serverPrompts: Prompt[] = response.data;
        if (serverPrompts.length > 0) {
          setPromptData(serverPrompts.map(p => toWelcomePrompt(p, dispatch)));
        } else {
          setPromptData((DataPrompts[category] || []).map(p => toWelcomePrompt(p, dispatch)));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPromptData((DataPrompts[category] || []).map(p => toWelcomePrompt(p, dispatch)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [category, dispatch]);

  const welcomePrompt = (
    <ChatbotWelcomePrompt
      title={showAtBottom ? t('Suggestions for this page') : `${t('Welcome to Kiali Chatbot')} ${username}`}
      description={showAtBottom ? '' : t('How may I help you today?')}
      prompts={promptData}
    />
  );

  return (
    <ChatbotContent>
      <MessageBox>
        {!showAtBottom && welcomePrompt}
        {chatHistory.map((entry, i) => (
          <EntryChat entryIndex={i} key={(entry.get('id') as string) ?? i} />
        ))}
        {showAtBottom && welcomePrompt}
        <div ref={chatHistoryEndRef} />
      </MessageBox>
    </ChatbotContent>
  );
};
