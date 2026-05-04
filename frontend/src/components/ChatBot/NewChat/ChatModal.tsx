import * as React from 'react';
import { Modal, ModalHeader, ModalBody, ModalVariant } from '@patternfly/react-core';

type Props = {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
};

export const ChatModal: React.FC<Props> = ({ children, className, isOpen, onClose, title }) => (
  <Modal
    className={`modal-dialog chatbotAI_${className ? ` ${className}` : ''}`}
    variant={ModalVariant.small}
    isOpen={isOpen}
    onClose={onClose}
    aria-label="modal-new-chat"
    data-test="new-chat-modal"
  >
    <ModalHeader title={title} titleIconVariant={'warning'} />
    <ModalBody>{children}</ModalBody>
  </Modal>
);
