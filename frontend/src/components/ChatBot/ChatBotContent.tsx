import React, { useEffect, useState } from 'react';
import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import {
  ChatbotAlert,
  ChatbotContent,
  ChatbotDisplayMode,
  ChatbotWelcomePrompt,
  MessageBox
} from '@patternfly/chatbot';
import { DataPrompts } from './DataPrompts';
import { useLocation } from 'react-router-dom-v5-compat';
import { AlertMessage, ChatResponse, ExtendedMessage } from 'types/Chatbot';
import { KialiAppState } from 'store/Store';
import { useSelector } from 'react-redux';
import { ChatHistoryEntry } from './ChatHistory/ChatHistory';
import { defer } from 'lodash';

type ChatBotContentProps = {
  alertMessage?: AlertMessage;
  botMessage: (response: ChatResponse | string) => ExtendedMessage;
  context: any;
  displayMode: ChatbotDisplayMode;
  handleSend: (query: string | number, context: any, title?: string) => void;
  isLoading: boolean;
  messages: ExtendedMessage[];
  setAlertMessage: (alertMessage?: AlertMessage) => void;
  username: string;
  chatHistoryEndRef: React.RefObject<HTMLDivElement>;
};

export const ChatBotContent: React.FC<ChatBotContentProps> = ({
  username,
  alertMessage,
  handleSend,
  setAlertMessage,
  context,
  chatHistoryEndRef
}) => {
  const { pathname } = useLocation();
  const conversationID = useSelector((state: KialiAppState) => state.aiChat.get('conversationID'));
  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector((state: KialiAppState) =>
    state.aiChat.get('chatHistory')
  );
  const category = pathname.split('/')[1];
  const [promptData, setPromptData] = useState<any>(DataPrompts[category] || []);

  const scrollIntoView = React.useCallback(
    (behavior = 'smooth') => {
      defer(() => {
        chatHistoryEndRef?.current?.scrollIntoView({ behavior: behavior as ScrollBehavior });
      });
    },
    [chatHistoryEndRef]
  );
  const generatePrompts = React.useCallback((): void => {
    setPromptData(
      (DataPrompts[category] || []).map(prompt => ({
        title: prompt.title,
        message: prompt.message,
        onClick: () => handleSend(prompt.query, context, prompt.title)
      }))
    );
  }, [category, context, handleSend]);

  React.useEffect(() => {
    scrollIntoView('instant');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    generatePrompts();
  }, [generatePrompts]);

  return (
    <ChatbotContent>
      <MessageBox>
        <ChatbotWelcomePrompt
          title={`Welcome to Kiali Chatbot ${username}`}
          description="How may I help you today?"
          prompts={promptData}
        />
        {alertMessage && (
          <ChatbotAlert
            title={alertMessage.title}
            onClose={() => setAlertMessage(undefined)}
            variant={alertMessage.variant}
          >
            {alertMessage.message}
          </ChatbotAlert>
        )}
        {chatHistory.map((entry, index) => (
          <ChatHistoryEntry
            conversationID={conversationID}
            entryIndex={index}
            key={(entry.get('id') as string) ?? index}
          />
        ))}
        <div ref={chatHistoryEndRef} />
      </MessageBox>
    </ChatbotContent>
  );
};
