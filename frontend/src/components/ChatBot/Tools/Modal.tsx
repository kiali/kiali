import * as React from 'react';
import { Modal as PatternflyModal, ModalHeader, ModalBody } from '@patternfly/react-core';

type Props = {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
};

export const Modal: React.FC<Props> = ({ children, className, isOpen, onClose, title }) => (
  <PatternflyModal
    className={`modal-dialog kiali-chatbot-plugin__modal${className ? ` ${className}` : ''}`}
    isOpen={isOpen}
    onClose={onClose}
  >
    <ModalHeader title={title} />
    <ModalBody>{children}</ModalBody>
  </PatternflyModal>
);
