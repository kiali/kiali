import React, { useEffect, useRef, useState } from 'react';
import { router } from '../../app/History';
import { ChatbotAlert, ChatbotContent, ChatbotWelcomePrompt, Message, MessageBox } from '@patternfly/chatbot';
import { DataPrompts } from './DataPrompts';
import { useLocation } from 'react-router-dom-v5-compat';
import { AlertMessage, ChatResponse, ExtendedMessage, ReferencedDocument, Action } from 'types/Chatbot';
import { Button, ExpandableSection } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { PuzzlePieceIcon } from '@patternfly/react-icons';

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


  const getActions = (actions: Action[]) => {
    const attachments: React.ReactNode[] = [];
    actions.forEach(action =>  attachments.push(
      <Button 
      key={action.title} 
      variant="tertiary"
      icon={action.kind === 'navigation' ? <ExternalLinkAltIcon /> : <PuzzlePieceIcon />}
      onClick={() => action.kind === 'navigation' ? router.navigate(action.payload) : console.log("Call tool", action.payload)}>
        {action.title}
      </Button>
      )
    );
    return attachments;
  }

  const getMessage = (
    message: Omit<ExtendedMessage, 'referenced_documents' | 'scrollToHere' | 'collapse' | 'actions'>,     
    index: number, referenced_documents: ReferencedDocument[], actions?: Action[], collapse?: boolean) => {  
      const messageProps: any = {
        key: `chatbot_message_${index}`,
        sources: referenced_documents && referenced_documents.length > 0 ? {sources: referenced_documents.map(document => ({link: document.link, title: document.title, body: document.body, isExternal: true}))} : undefined
      };
      
      if (message.role !== 'user') {
        messageProps.botWord = "Kiali AI";
        messageProps.loadingWord = "Thinking...";
      }

      const messageActions = actions && actions.length > 0 ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
          {getActions(actions)}
        </div>
      ) : undefined;

      return (
        <>
          {collapse ? (
            <ExpandableSection toggleText="Show more">
              <>
              <Message {...messageProps} {...message} />
              {messageActions}
              </>
            </ExpandableSection>
          ) : (
            <>
            <Message {...messageProps} {...message}/>
            {messageActions}
            </>
          )}
        </>
      );
  }
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
        {messages.map(({ actions, referenced_documents, scrollToHere, collapse, ...message }: ExtendedMessage, index) => {
          return (
          <div key={`chatbot_message_div_${index}`}>
            {scrollToHere && <div key={`chatbot_message_container_scroll_div_${index}`} ref={messagesEndRef} />}
            <div key={`chatbot_message_container_div_${index}`}>
            {getMessage(message, index, referenced_documents, actions, collapse)}             
            </div>
          </div>
          )
        })}
        {messages.at(-1)?.role === 'user' && isLoading ? (
          <Message botWord="Kiali AI" key="bott_message_9999" {...botMessage('...')} isLoading={true} />
        ) : (
          <></>
        )}
      </MessageBox>
    </ChatbotContent>
  );
};
