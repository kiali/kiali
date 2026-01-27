import React, { useEffect, useRef, useState } from 'react';
import {
  ChatbotAlert,
  ChatbotContent,
  ChatbotDisplayMode,
  ChatbotWelcomePrompt,
  Message,
  MessageBox
} from '@patternfly/chatbot';
import { DataPrompts } from './DataPrompts';
import { useLocation } from 'react-router-dom-v5-compat';
import { AlertMessage, ChatResponse, ExtendedMessage } from 'types/Chatbot';
import { ChatMessage } from './ChatMessage/ChatMessage';

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
};

export const ChatBotContent: React.FC<ChatBotContentProps> = ({
  username,
  alertMessage,
  handleSend,
  setAlertMessage,
  isLoading,
  displayMode,
  messages,
  botMessage,
  context
}) => {
  const { pathname } = useLocation();
  const category = pathname.split('/')[1];
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [promptData, setPromptData] = useState<any>(DataPrompts[category] || []);
  const scrollToBottom = (): void => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const generatePrompts = React.useCallback((): void => {
    setPromptData(
      (DataPrompts[category] || []).map(prompt => ({
        title: prompt.title,
        message: prompt.message,
        onClick: () => handleSend(prompt.query, context, prompt.title)
      }))
    );
  }, [category, context, handleSend]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        {messages.map(
          ({ referenced_documents, scrollToHere, collapse, actions, ...message }: ExtendedMessage, index) => {
            return (
              <ChatMessage
                key={`chatbot_message_${index}`}
                index={index.toString()}
                message={message}
                referenced_documents={referenced_documents}
                collapse={collapse}
                actions={actions || []}
                scrollToHere={scrollToHere}
                innerRef={messagesEndRef}
                displayMode={displayMode}
              />
            );
          }
        )}
        {messages.at(-1)?.role === 'user' && isLoading ? (
          <Message botWord="Kiali AI" key="bott_message_9999" {...botMessage('...')} isLoading={true} />
        ) : (
          <></>
        )}
      </MessageBox>
    </ChatbotContent>
  );
};
