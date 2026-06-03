import React from 'react';
import { Map as ImmutableMap, List as ImmutableList } from 'immutable';
import { ChatbotContent, ChatbotWelcomePrompt, MessageBox } from '@patternfly/chatbot';
import type { WelcomePrompt } from '@patternfly/chatbot/dist/esm/ChatbotWelcomePrompt/ChatbotWelcomePrompt';
import { useDispatch, useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { EntryChat } from './EntryChat/EntryChat';
import { t } from 'utils/I18nUtils';
import { ChatAIActions } from 'actions/ChatAIActions';

type ChatBotContentProps = {
  chatHistoryEndRef: React.RefObject<HTMLDivElement>;
};

export const ChatBotContent: React.FC<ChatBotContentProps> = ({ chatHistoryEndRef }) => {
  const dispatch = useDispatch();
  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector(
    (s: KialiAppState) => s.aiChat.chatHistory
  );
  const username = useSelector((state: KialiAppState) => state.authentication.session?.username ?? '');
  const welcomePrompts = React.useMemo<WelcomePrompt[]>(
    () => [
      {
        title: t('What can you help me with?'),
        message: t('Learn what the chatbot can do in Kiali.'),
        onClick: () => dispatch(ChatAIActions.setQuery(t('What can you help me with in Kiali?')))
      }
    ],
    [dispatch]
  );

  return (
    <ChatbotContent>
      <MessageBox>
        {chatHistory.size === 0 && (
          <ChatbotWelcomePrompt
            title={`${t('Welcome to Kiali Chatbot')}${username ? ` ${username}` : ''}`}
            description={t('How may I help you today?')}
            prompts={welcomePrompts}
          />
        )}
        {chatHistory.map((entry, i) => (
          <EntryChat entryIndex={i} key={(entry.get('id') as string) ?? i} />
        ))}
        <div ref={chatHistoryEndRef} />
      </MessageBox>
    </ChatbotContent>
  );
};
