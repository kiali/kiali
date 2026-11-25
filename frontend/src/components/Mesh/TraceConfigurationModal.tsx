import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Popover
} from '@patternfly/react-core';
import { HelpIcon } from '@patternfly/react-icons';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { DiscoveryTracingConfig } from './DiscoveryTracingConfig';

const traceConfigurationModalTitleId = 'trace-configuration-modal-title';

type TraceConfigurationModalProps = {
  cluster: string;
  isOpen: boolean;
  onClose: () => void;
};

export const TraceConfigurationModal: React.FC<TraceConfigurationModalProps> = ({ cluster, isOpen, onClose }) => {
  const { t } = useKialiTranslation();

  if (!isOpen) {
    return null;
  }

  const title = t('Configuration Discovery');
  const help = (
    <Popover
      headerContent={title}
      bodyContent={
        <>
          {t(
            'Check the usual ports for the tracing service and provide a subset of the tracing configuration based on the tracing services found for external_services.tracing.'
          )}
          <br />
          {t(
            'Discovery uses internal_url when set and falls back to external_url. Tempo HTTP reports readiness and query verification separately.'
          )}
          <br />
          {t(
            'Discovery checks candidate addresses without credentials and verifies authentication only for the deployed backend.'
          )}
        </>
      }
    >
      <Button variant={ButtonVariant.plain} aria-label={t('Help')} icon={<HelpIcon />} />
    </Popover>
  );

  return (
    <Modal
      aria-labelledby={traceConfigurationModalTitleId}
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={onClose}
      data-test="modal-tracing-discovery"
    >
      <ModalHeader labelId={traceConfigurationModalTitleId} title={title} help={help} />
      <ModalBody>
        <DiscoveryTracingConfig cluster={cluster} />
      </ModalBody>
      <ModalFooter>
        <Button key="close" onClick={onClose}>
          {t('Close')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
