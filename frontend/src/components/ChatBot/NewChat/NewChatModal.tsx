import * as React from 'react';
import { ActionGroup, Button, Content, Form } from '@patternfly/react-core';
import { t } from 'i18next';
import { ChatModal } from './ChatModal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  providerChanged?: boolean;
};

export const NewChatModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, providerChanged }) => {
  return (
    <ChatModal isOpen={isOpen} onClose={onClose} title={'Confirm chat deletion'}>
      <Content component="p">
        {providerChanged
          ? t(
              'Changing the AI provider requires starting a new chat. Are you sure you want to continue? This action cannot be undone.'
            )
          : t(
              'Are you sure you want to erase the current chat conversation and start a new chat? This action cannot be undone.'
            )}
      </Content>
      <Form>
        <ActionGroup>
          <Button data-test="new-chat-confirm" key="confirm" onClick={onConfirm} variant="danger">
            {t('Erase and start new chat')}
          </Button>
          <Button data-test="new-chat-cancel" key="cancel" onClick={onClose} variant="link">
            {t('Cancel')}
          </Button>
        </ActionGroup>
      </Form>
    </ChatModal>
  );
};
