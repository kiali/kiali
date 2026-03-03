import React, { useState, useEffect } from 'react';
import { ChatbotFooter, ChatbotFootnote, ChatbotFootnoteProps, MessageBar } from '@patternfly/chatbot';
import { style } from 'typestyle';
import { FOOTNOTE_LABEL } from 'config/Constants';
import { Switch } from '@patternfly/react-core';
import { CHATBOT_CONVERSATION_ALWAYS_NAVIGATE, Tool } from 'types/Chatbot';
import { ResponseToolModal } from './ChatMessage/ResponseToolModal';

type ChatBotFooterProps = {
  setAlertMessage: () => void;
  handleSend: (msg: string | number, context?: any) => void;
  toolModalOpen: boolean;
  tool: Tool | undefined;
  setToolModalOpen: (toolModalOpen: boolean) => void;
  setTool: (tool: Tool | undefined) => void;
};

const footnoteProps: ChatbotFootnoteProps = {
  label: FOOTNOTE_LABEL
};

export const ChatBotFooter: React.FC<ChatBotFooterProps> = ({ setAlertMessage, handleSend, toolModalOpen, tool, setToolModalOpen, setTool }) => {
  const [alwaysNavigate, setAlwaysNavigate] = useState(false);

  useEffect(() => {
    const storedValue = localStorage.getItem(CHATBOT_CONVERSATION_ALWAYS_NAVIGATE);
    if (storedValue !== null) {
      setAlwaysNavigate(storedValue === 'true');
    } else {
      setAlwaysNavigate(false);
    }
  }, []);

  const handleAlwaysNavigateChange = (_event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
    setAlwaysNavigate(checked);
    localStorage.setItem(CHATBOT_CONVERSATION_ALWAYS_NAVIGATE, String(checked));
  };

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
      <ResponseToolModal isOpen={toolModalOpen} onClose={() => {setToolModalOpen(false); setTool(undefined);}} tool={tool} />
      <Switch
        id={CHATBOT_CONVERSATION_ALWAYS_NAVIGATE}
        label={'Allow Chatbot to navigate'}
        isChecked={alwaysNavigate}
        onChange={handleAlwaysNavigateChange}
      />
      <ChatbotFootnote {...footnoteProps} />
    </ChatbotFooter>
  );
};
