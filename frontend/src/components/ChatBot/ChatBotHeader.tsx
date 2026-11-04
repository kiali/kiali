import React from 'react';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { ChatbotHeader, ChatbotHeaderActions } from '@patternfly/chatbot';
import { TrashIcon, WindowMinimizeIcon } from '@patternfly/react-icons';
import { t } from 'utils/I18nUtils';

type ChatBotHeaderProps = {
  onCloseChat: () => void;
  onNewChat: () => void;
};

export const ChatBotHeader: React.FC<ChatBotHeaderProps> = ({ onCloseChat, onNewChat }) => {
  return (
    <ChatbotHeader>
      <ChatbotHeaderActions>
        <Tooltip content={t('Clear chat')}>
          <Button
            aria-label={t('Clear chat')}
            variant={ButtonVariant.plain}
            size="sm"
            icon={<TrashIcon />}
            onClick={onNewChat}
          />
        </Tooltip>
        <Tooltip content={t('Minimize')}>
          <Button
            aria-label={t('Minimize')}
            variant={ButtonVariant.plain}
            size="sm"
            icon={<WindowMinimizeIcon />}
            onClick={onCloseChat}
            data-test="chatbot-minimize"
          />
        </Tooltip>
      </ChatbotHeaderActions>
    </ChatbotHeader>
  );
};
