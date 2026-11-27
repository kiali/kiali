import React from 'react';
import { ChatbotFooter, ChatbotFootnote } from '@patternfly/chatbot';
import type { ChatbotFootnoteProps } from '@patternfly/chatbot';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { WrenchIcon } from '@patternfly/react-icons';
import { FOOTNOTE_LABEL } from 'config/Constants';
import { t } from 'utils/I18nUtils';
import { NewChatModal } from './NewChat/NewChatModal';
import { Prompt } from './Prompt';
import { useKialiDispatch } from 'hooks/redux';
import { GlobalActions } from 'actions/GlobalActions';
import { kialiStyle } from 'styles/StyleUtils';

type ChatBotFooterProps = {
  isNewChatModalOpen: boolean;
  onConfirm: () => void;
  onSelectProviderModel: (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => void;
  providerChanged: boolean;
  scrollIntoView: () => void;
  setIsNewChatModalOpen: (isOpen: boolean) => void;
};

const footnoteProps: ChatbotFootnoteProps = {
  label: FOOTNOTE_LABEL
};

const aiSettingsStyle = kialiStyle({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  paddingLeft: 0,
  paddingRight: 0
});

export const ChatBotFooter: React.FC<ChatBotFooterProps> = ({
  providerChanged,
  isNewChatModalOpen,
  setIsNewChatModalOpen,
  scrollIntoView,
  onConfirm,
  onSelectProviderModel
}) => {
  const dispatch = useKialiDispatch();

  const openAISettings = (): void => {
    dispatch(GlobalActions.setPreferencesOpen(true));
  };

  return (
    <ChatbotFooter>
      <Prompt onSelectProviderModel={onSelectProviderModel} scrollIntoView={scrollIntoView} />
      <Button
        className={aiSettingsStyle}
        data-test="chatbot-ai-settings"
        icon={<WrenchIcon />}
        onClick={openAISettings}
        variant={ButtonVariant.link}
      >
        {t('AI settings')}
      </Button>
      <ChatbotFootnote {...footnoteProps} />
      <NewChatModal
        providerChanged={providerChanged}
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onConfirm={onConfirm}
      />
    </ChatbotFooter>
  );
};
