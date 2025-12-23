import React from 'react';
import { ChatbotFooter, ChatbotFootnote, ChatbotFootnoteProps, MessageBar } from '@patternfly/chatbot';
import { style } from 'typestyle';
import { FOOTNOTE_LABEL } from 'config/Constants';

type ChatBotFooterProps = {
  setAlertMessage: () => void;
  handleSend: (msg: string | number, context?: any) => void;
};

const footnoteProps: ChatbotFootnoteProps = {
  label: FOOTNOTE_LABEL
};

export const ChatBotFooter: React.FC<ChatBotFooterProps> = ({ setAlertMessage, handleSend }) => {
  return (
    <ChatbotFooter>
      <MessageBar
        onFocus={() => setAlertMessage()}
        onSendMessage={msg => handleSend(msg)}
        alwayShowSendButton
        hasAttachButton={false}
        buttonProps={{
          send: {
            tooltipProps: {
              className: style({ visibility: 'hidden' })
            }
          }
        }}
      />
      <ChatbotFootnote {...footnoteProps} />
    </ChatbotFooter>
  );
};
