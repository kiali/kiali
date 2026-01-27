import React from 'react';
import { ChatbotDisplayMode, Message, MessageProps } from '@patternfly/chatbot';
import { Button, ExpandableSection } from '@patternfly/react-core';
import { Action, ExtendedMessage, ReferencedDocument } from 'types/Chatbot';
import { router } from 'app/History';
import { ArrowRightIcon } from '@patternfly/react-icons';
import { FileAttachment } from './FileAttachment';
import { ChatMessageMarkdown } from './ChatMessageMarkdown';

type ChatMessageProps = {
  actions: Action[];
  collapse?: boolean;
  displayMode: ChatbotDisplayMode;
  index: string;
  innerRef: React.RefObject<HTMLDivElement>;
  message: MessageProps;
  referenced_documents: ReferencedDocument[];
  scrollToHere?: boolean;
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  actions,
  displayMode,
  referenced_documents,
  collapse,
  message,
  index,
  scrollToHere,
  innerRef
}) => {
  const renderAction = (actions: Action[]): React.ReactNode => {
    return actions.map(action => (
      <Button
        icon={<ArrowRightIcon />}
        key={`chatbot_action_${action.title}`}
        onClick={() => router.navigate(action.payload)}
        variant="link"
        isInline
      >
        {action.title}
      </Button>
    ));
  };

  const getMessage = (
    message: Omit<ExtendedMessage, 'referenced_documents' | 'scrollToHere' | 'collapse' | 'actions'>,
    index: string,
    referenced_documents: ReferencedDocument[],
    collapse?: boolean,
    actions?: Action[]
  ): React.ReactNode => {
    const messageProps: any = {
      key: `chatbot_message_${index}`,
      openLinkInNewTab: true,
      sources:
        referenced_documents && referenced_documents.length > 0
          ? {
              sources: referenced_documents.map(document => ({
                link: document.link,
                title: document.title,
                body: `${document.body.substring(0, 30)}...`,
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '0 0 1rem' }}>
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
                      fileName={action.fileName || ''}
                      code={action.payload}
                      displayMode={displayMode}
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
        {getMessage(message, index, referenced_documents, collapse, actions)}
      </div>
    </div>
  );
};
