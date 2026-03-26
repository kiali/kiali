import React from 'react';
import { ChatbotDisplayMode, Message, MessageProps } from '@patternfly/chatbot';
import { Button, ExpandableSection } from '@patternfly/react-core';
import { Action, ExtendedMessage, ReferencedDoc } from 'types/Chatbot';
import { router } from 'app/History';
import { ArrowRightIcon } from '@patternfly/react-icons';
import { FileAttachment } from './FileAttachment';
import { ChatMessageMarkdown } from './ChatMessageMarkdown';

type ChatMessageProps = {
  actions: Action[];
  addBotMessage?: (content: string) => void;
  collapse?: boolean;
  context?: any;
  displayMode: ChatbotDisplayMode;
  index: string;
  innerRef: React.RefObject<HTMLDivElement>;
  message: MessageProps;
  onSendMessage?: (query: string | number, context?: any, title?: string) => void;
  referenced_docs: ReferencedDoc[];
  scrollToHere?: boolean;
  setAlertMessage?: (alertMessage?: any) => void;
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  actions,
  addBotMessage,
  context,
  displayMode,
  referenced_docs,
  collapse,
  message,
  index,
  scrollToHere,
  innerRef,
  onSendMessage,
  setAlertMessage
}) => {
  const renderAction = (actions: Action[]): React.ReactNode => {
    return actions.map(action => (
      <Button
        icon={<ArrowRightIcon />}
        key={`chatbot_action_${action.title}`}
        onClick={() => router.navigate(action.payload)}
        variant="link"
        isInline
        data-testid={`chatbot-navigation-action-link-${action.title.toLowerCase().replace(/ /g, '-')}`}
      >
        {action.title}
      </Button>
    ));
  };

  const getMessage = (
    message: Omit<ExtendedMessage, 'referenced_docs' | 'scrollToHere' | 'collapse' | 'actions'>,
    index: string,
    referenced_docs: ReferencedDoc[],
    collapse?: boolean,
    actions?: Action[]
  ): React.ReactNode => {
    const messageProps: any = {
      key: `chatbot_message_${index}`,
      openLinkInNewTab: true,
      sources:
        referenced_docs && referenced_docs.length > 0
          ? {
              sources: referenced_docs.map(document => ({
                link: document.doc_url,
                title: document.doc_title,
                isExternal: true
              }))
            }
          : undefined
    };

    if (message.role !== 'user') {
      messageProps.botWord = 'Kiali AI';
      messageProps.loadingWord = 'Thinking...';
    }

    const NavigationAction = actions && actions.filter(action => action.kind === 'navigation').length > 0;
    const FileAction = actions && actions.filter(action => action.kind === 'file').length > 0;

    const safeContent =
      typeof message.content === 'string' ? message.content : message.content ? String(message.content) : '';
    const markdownContent = safeContent ? (
      <ChatMessageMarkdown
        content={safeContent}
        codeBlockProps={message.codeBlockProps}
        openLinkInNewTab={messageProps.openLinkInNewTab}
      />
    ) : null;
    const mergedExtraContent =
      markdownContent || message.extraContent
        ? {
            ...message.extraContent,
            beforeMainContent: (
              <>
                {message.extraContent?.beforeMainContent}
                {markdownContent}
              </>
            )
          }
        : message.extraContent;
    const safeMessage: typeof message = {
      ...message,
      content: markdownContent ? '' : safeContent,
      extraContent: mergedExtraContent
    };

    const messageContent = (
      <>
        <Message {...safeMessage} {...messageProps} />
        {actions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '0 0 1rem 5rem' }}>
            {NavigationAction && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '0 0 1rem' }}
                data-testid="chatbot-navigation-action"
              >
                {renderAction(actions.filter(action => action.kind === 'navigation'))}
              </div>
            )}
            {FileAction && (
              <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
                {actions
                  .filter(action => action.kind === 'file')
                  .map(action => (
                    <FileAttachment
                      key={action.fileName}
                      addBotMessage={addBotMessage}
                      fileName={action.fileName || ''}
                      action={action}
                      displayMode={displayMode}
                      context={context}
                      onSendMessage={onSendMessage}
                      setAlertMessage={setAlertMessage}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </>
    );

    return (
      <>{collapse ? <ExpandableSection toggleText="Show more">{messageContent}</ExpandableSection> : messageContent}</>
    );
  };

  return (
    <div key={`chatbot_message_div_${index}`}>
      {scrollToHere && <div key={`chatbot_message_container_scroll_div_${index}`} ref={innerRef} />}
      <div key={`chatbot_message_container_div_${index}`}>
        {getMessage(message, index, referenced_docs, collapse, actions)}
      </div>
    </div>
  );
};
