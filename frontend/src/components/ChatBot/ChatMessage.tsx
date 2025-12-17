import React from 'react';
import { AttachmentEdit, ChatbotDisplayMode, Message, MessageProps, PreviewAttachment } from '@patternfly/chatbot';
import { Button, ExpandableSection } from '@patternfly/react-core';
import { Action, ExtendedMessage, ReferencedDocument } from 'types/Chatbot';
import { router } from 'app/History';
import { ArrowRightIcon } from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';

const footerStyle = kialiStyle({
  display: 'none'
});

interface ModalData {
    code: string;
    fileName: string;
}

type ChatMessageProps = {
    message: MessageProps;
    actions: Action[];
    index: string;
    scrollToHere?: boolean;
    referenced_documents: ReferencedDocument[];
    collapse?: boolean;
    displayMode: ChatbotDisplayMode;
    innerRef: React.RefObject<HTMLDivElement>
}

export const ChatMessage: React.FC<ChatMessageProps> = ({actions, displayMode, referenced_documents, collapse, message, index, scrollToHere, innerRef}) => {
    const [isPreviewModalOpen, setIsPreviewModalOpen] = React.useState<boolean>(false);
    const [isEditModalOpen, setIsEditModalOpen] = React.useState<boolean>(false);
    const [currentModalData, setCurrentModalData] = React.useState<ModalData>();

    const renderAction = (actions: Action[]) => {
        return actions.map(action => (
            <Button
                icon={<ArrowRightIcon />}
                variant="link"
                isInline
                key={`chatbot_action_${action.title}`}
                onClick={() => router.navigate(action.payload)}
            >
                {action.title}
            </Button>
        ))          
      };

      const getMessage = (
        message: Omit<ExtendedMessage, 'referenced_documents' | 'scrollToHere' | 'collapse' | 'actions'>,
        index: string,
        referenced_documents: ReferencedDocument[],
        collapse?: boolean,
        actions?: Action[]
      ) => {
        console.log('actions', actions);
        const messageProps: any = {
          key: `chatbot_message_${index}`,
          openLinkInNewTab: true,
          sources:
            referenced_documents && referenced_documents.length > 0
              ? {
                  sources: referenced_documents.map(document => ({
                    link: document.link,
                    title: document.title,
                    body: document.body.substring(0, 30) + '...',
                    isExternal: true
                  }))
                }
              : undefined,
           attachments: actions && actions.filter(action => action.kind === 'file').map(action => ({
            name: action.title,
            onClick: () => {setCurrentModalData({ code: action.payload || '', fileName: action.fileName || ''}); setIsPreviewModalOpen(true);},
            onClose: () => {setCurrentModalData(undefined); setIsPreviewModalOpen(false);}
          }))
        };
    
        if (message.role !== 'user') {
          messageProps.botWord = 'Kiali AI';
          messageProps.loadingWord = 'Thinking...';
        }

        
    
        const messageContent = (
          <>
            <Message {...messageProps} {...message} />
            {actions && renderAction(actions.filter(action => action.kind === 'navigation'))}
            {currentModalData && (
                <>
                    <PreviewAttachment
                        fileName={currentModalData?.fileName || ''}
                        code={currentModalData?.code || ''}
                        isModalOpen={isPreviewModalOpen}
                        displayMode={displayMode}
                        onEdit={() => {setIsEditModalOpen(true);}}
                        onDismiss={() => {setCurrentModalData(undefined); setIsPreviewModalOpen(false);}}
                        handleModalToggle={() => setIsPreviewModalOpen(false)}
                        modalFooterClassName={footerStyle}
                    />
                    <AttachmentEdit
                        fileName={currentModalData?.fileName || ''}
                        code={currentModalData?.code || ''}
                        displayMode={displayMode}
                        isModalOpen={isEditModalOpen}
                        onCancel={() => {setCurrentModalData(undefined)}}
                        onSave={() => {setCurrentModalData(undefined)}}
                        handleModalToggle={() => setIsEditModalOpen(false)}
                        modalFooterClassName={footerStyle}
                    />
                </>
           )}
          </>
        );

        return (
          <>
            {collapse ? (
              <ExpandableSection toggleText="Show more">{messageContent}</ExpandableSection>
            ) : (
              messageContent
            )}
          </>
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


}