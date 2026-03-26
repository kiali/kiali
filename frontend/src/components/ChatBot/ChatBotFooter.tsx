import React, { useState, useEffect } from 'react';
import { ChatbotFooter, ChatbotFootnote, ChatbotFootnoteProps, MessageBar } from '@patternfly/chatbot';
import { style } from 'typestyle';
import { FOOTNOTE_LABEL } from 'config/Constants';
import { Switch } from '@patternfly/react-core';
import { CHATBOT_CONVERSATION_ALWAYS_NAVIGATE } from 'types/Chatbot';

type ChatBotFooterProps = {
  handleSend: (msg: string | number, context?: any) => void;
  setAlertMessage: () => void;
};

const footnoteProps: ChatbotFootnoteProps = {
  label: FOOTNOTE_LABEL
};

export const ChatBotFooter: React.FC<ChatBotFooterProps> = ({ setAlertMessage, handleSend }) => {
  const [alwaysNavigate, setAlwaysNavigate] = useState(false);

  useEffect(() => {
    const storedValue = localStorage.getItem(CHATBOT_CONVERSATION_ALWAYS_NAVIGATE);
    if (storedValue !== null) {
      setAlwaysNavigate(storedValue === 'true');
    } else {
      setAlwaysNavigate(false);
    }
  }, []);

  const handleAlwaysNavigateChange = (_event: React.FormEvent<HTMLInputElement>, checked: boolean): void => {
    setAlwaysNavigate(checked);
    localStorage.setItem(CHATBOT_CONVERSATION_ALWAYS_NAVIGATE, String(checked));
    return;
  };

  return (
    <ChatbotFooter>
      <MessageBar
        data-testid="chatbot-message-bar-input"
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
      <Switch
        id={CHATBOT_CONVERSATION_ALWAYS_NAVIGATE}
        data-testid="chatbot-always-navigate-switch"
        label={'Allow Chatbot to navigate'}
        isChecked={alwaysNavigate}
        onChange={handleAlwaysNavigateChange}
      />
      <ChatbotFootnote {...footnoteProps} />
    </ChatbotFooter>
  );
};
