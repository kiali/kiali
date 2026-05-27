import * as React from 'react';
import { Button, ButtonVariant, Modal, ModalBody, ModalHeader, ModalVariant } from '@patternfly/react-core';
import { ChatSessionUsageContent } from 'pages/ChatSessionUsage/ChatSessionUsagePage';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

type ChatSessionUsageModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const modalStyle = kialiStyle({
  maxHeight: '88vh'
});

const modalBodyStyle = kialiStyle({
  padding: 0
});

const modalFooterStyle = kialiStyle({
  borderTop: '1px solid var(--pf-t--global--border--color--default)',
  display: 'flex',
  justifyContent: 'flex-end',
  padding: 'var(--pf-t--global--spacer--sm) var(--pf-t--global--spacer--lg)'
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
      <div className={modalFooterStyle}>
        <Button onClick={onClose} variant={ButtonVariant.primary}>
          {t('Close')}
        </Button>
      </div>
    </Modal>
  );
};
