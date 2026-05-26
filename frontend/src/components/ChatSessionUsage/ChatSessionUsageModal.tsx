import * as React from 'react';
import { Modal, ModalBody, ModalHeader, ModalVariant } from '@patternfly/react-core';
import { ChatSessionUsageContent } from 'pages/ChatSessionUsage/ChatSessionUsagePage';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

type ChatSessionUsageModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const modalStyle = kialiStyle({
  height: '90%'
});

const modalBodyStyle = kialiStyle({
  padding: 0
});

export const ChatSessionUsageModal: React.FC<ChatSessionUsageModalProps> = ({
  isOpen,
  onClose
}: ChatSessionUsageModalProps) => {
  if (!isOpen) {
    return null;
  }

  const titleId = 'chat-session-usage-modal-title';

  return (
    <Modal className={modalStyle} isOpen={isOpen} onClose={onClose} variant={ModalVariant.large}>
      <ModalHeader labelId={titleId} title={t('Session Token Stats')} />
      <ModalBody className={modalBodyStyle}>
        <ChatSessionUsageContent />
      </ModalBody>
    </Modal>
  );
};
