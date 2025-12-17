import React, { useEffect, useRef, useState } from 'react';
import { ChatbotAlert, ChatbotContent, ChatbotWelcomePrompt, Message, MessageBox } from '@patternfly/chatbot';
import { DataPrompts } from './DataPrompts';
import { useLocation } from 'react-router-dom-v5-compat';
import { AlertMessage, ChatResponse, ExtendedMessage } from 'types/Chatbot';
import { ExpandableSection } from '@patternfly/react-core';

type ChatBotContentProps = {
  username: string;
  alertMessage?: AlertMessage;
  handleSend: (query: string | number, context: any, title?: string) => void;
  setAlertMessage: (alertMessage?: AlertMessage) => void;
  messages: ExtendedMessage[];
  isLoading: boolean;
  botMessage: (response: ChatResponse | string, _?: string) => ExtendedMessage;
  context: any;
};

export const ChatBotContent: React.FC<ChatBotContentProps> = ({
  username,
  alertMessage,
  handleSend,
  setAlertMessage,
  isLoading,
  messages,
  botMessage,
  context
}) => {
  const { pathname } = useLocation();
  const category = pathname.split('/')[1];
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [promptData, setPromptData] = useState<any>(DataPrompts[category] || []);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generatePrompts = React.useCallback(() => {
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
          title={'Welcome to Kiali Chatbot ' + username}
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
        {messages.map(({ referenced_documents, scrollToHere, collapse, ...message }: ExtendedMessage, index) => (
          <div key={`chatbot_message_div_${index}`}>
            {scrollToHere && <div key={`chatbot_message_container_scroll_div_${index}`} ref={messagesEndRef} />}
            <div key={`chatbot_message_container_div_${index}`}>
              {collapse ? (
                <>
                  <ExpandableSection toggleText="Show more">
                    <Message key={`chatbot_message_${index}`} {...message} isLoading={isLoading && !message.content} />
                  </ExpandableSection>
                </>
              ) : (
                <>
                  <Message key={`chatbot_message_${index}`} {...message} />
                </>
              )}
            </div>
          </div>
        ))}
        {messages.at(-1)?.role === 'user' && isLoading ? (
          <Message key="bott_message_9999" {...botMessage('...')} isLoading={true} />
        ) : (
          <></>
        )}
      </MessageBox>
    </ChatbotContent>
  );
};
