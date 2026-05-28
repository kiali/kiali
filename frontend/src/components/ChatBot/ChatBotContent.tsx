import React, { useEffect, useState } from 'react';
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

export const ChatBotContent: React.FC<ChatBotContentProps> = ({ chatHistoryEndRef }) => {
  const { pathname } = useLocation();
  const category = pathname.split('/')[1];
  const [promptData, setPromptData] = useState<WelcomePrompt[]>([]);
  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector(
    (s: KialiAppState) => s.aiChat.chatHistory
  );
  const username = useSelector((state: KialiAppState) => state.authentication.session?.username ?? '');
  const dispatch = useDispatch();

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

  return (
    <ChatbotContent>
      <MessageBox>
        <ChatbotWelcomePrompt
          title={`${t('Welcome to Kiali Chatbot')} ${username}`}
          description={t('How may I help you today?')}
          prompts={promptData}
        />
        {chatHistory.map((entry, i) => (
          <EntryChat entryIndex={i} key={(entry.get('id') as string) ?? i} />
        ))}
        <div ref={chatHistoryEndRef} />
      </MessageBox>
    </ChatbotContent>
  );
};
