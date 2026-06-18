import React from 'react';
import { ChatbotFooter, ChatbotFootnote, ChatbotFootnoteProps } from '@patternfly/chatbot';
import { FOOTNOTE_LABEL } from 'config/Constants';
import { t } from 'utils/I18nUtils';
import { Switch } from '@patternfly/react-core';
import { NewChatModal } from './NewChat/NewChatModal';
import { Prompt } from './Prompt';
import { useKialiDispatch } from 'hooks/redux';
import { ChatAIActions } from 'actions/ChatAIActions';
import { useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';

type ChatBotFooterProps = {
  isNewChatModalOpen: boolean;
  onConfirm: () => void;
  providerChanged: boolean;
  scrollIntoView: () => void;
  setIsNewChatModalOpen: (isOpen: boolean) => void;
};

const footnoteProps: ChatbotFootnoteProps = {
  label: FOOTNOTE_LABEL
};

export const ChatBotFooter: React.FC<ChatBotFooterProps> = ({
  providerChanged,
  isNewChatModalOpen,
  setIsNewChatModalOpen,
  scrollIntoView,
  onConfirm
}) => {
  const dispatch = useKialiDispatch();
  const alwaysNavigate = useSelector((state: KialiAppState) => state.aiChat.alwaysNavigate);

  const handleAlwaysNavigateChange = (_event: React.FormEvent<HTMLInputElement>, checked: boolean): void => {
    dispatch(ChatAIActions.setAlwaysNavigate({ alwaysNavigate: checked }));
  };

  return (
    <ChatbotFooter>
      <Prompt scrollIntoView={scrollIntoView} />
      <Switch
        id="chatbot-always-navigate-switch"
        data-testid="chatbot-always-navigate-switch"
        label={t('Allow Chatbot to navigate')}
        isChecked={alwaysNavigate}
        onChange={handleAlwaysNavigateChange}
      />
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
