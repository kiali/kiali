import React from 'react';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { ChatbotHeader, ChatbotHeaderActions, ChatbotHeaderTitle } from '@patternfly/chatbot';
import { TrashIcon, WindowMinimizeIcon } from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';
import { PFFontWeight } from 'styles/PfTypography';
import { t } from 'utils/I18nUtils';

type ChatBotHeaderProps = {
  onCloseChat: () => void;
  onNewChat: () => void;
};

const welcomeTitleStyle = kialiStyle({
  color: 'var(--pf-t--global--color--brand--default)',
  fontSize: 'var(--pf-t--global--font--size--xl)',
  fontWeight: PFFontWeight.HeadingBold,
  lineHeight: 'var(--pf-t--global--font--line-height--heading)',
  margin: 0
});

export const ChatBotHeader: React.FC<ChatBotHeaderProps> = ({ onCloseChat, onNewChat }) => {
  return (
    <ChatbotHeader>
      <ChatbotHeaderTitle>
        <h1 className={welcomeTitleStyle}>{t('Welcome to Kiali Chatbot')}</h1>
      </ChatbotHeaderTitle>
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
