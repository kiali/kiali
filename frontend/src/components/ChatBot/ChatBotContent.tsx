import React, { useEffect, useState } from 'react';
import { Map as ImmutableMap, List as ImmutableList } from 'immutable';
import { ChatbotContent, ChatbotWelcomePrompt, MessageBox } from '@patternfly/chatbot';
import { t } from 'utils/I18nUtils';
import { DataPrompts } from './DataPrompts';
import { useLocation } from 'react-router-dom-v5-compat';
import { useDispatch, useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { EntryChat } from './EntryChat/EntryChat';
import { ChatAIActions } from 'actions/ChatAIActions';

type ChatBotContentProps = {
  chatHistoryEndRef: React.RefObject<HTMLDivElement>;
};

export const ChatBotContent: React.FC<ChatBotContentProps> = ({ chatHistoryEndRef }) => {
  const { pathname } = useLocation();
  const category = pathname.split('/')[1];
  const [promptData, setPromptData] = useState<any>(DataPrompts[category] || []);
  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector(
    (s: KialiAppState) => s.aiChat.chatHistory
  );
  const username = useSelector((state: KialiAppState) => state.authentication.session?.username ?? '');
  const dispatch = useDispatch();
  //const conversationID: string = useSelector((s: KialiAppState) => s.aiChat.conversationID);
  const generatePrompts = React.useCallback((): void => {
    setPromptData(
      (DataPrompts[category] || []).map(prompt => ({
        title: prompt.title,
        message: prompt.message,
        onClick: () => dispatch(ChatAIActions.setQuery(prompt.query))
      }))
    );
  }, [category, dispatch]);

  useEffect(() => {
    generatePrompts();
  }, [generatePrompts]);

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
