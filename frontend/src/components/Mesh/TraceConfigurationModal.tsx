import * as React from 'react';
import { Button, ButtonVariant, Popover } from '@patternfly/react-core';
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';
import { HelpIcon } from '@patternfly/react-icons';
import type { TracingInfo } from '../../types/TracingInfo';
import { useKialiTranslation } from '../../utils/I18nUtils';
import type { ExternalServiceInfo } from '../../types/StatusState';
import { TempoUrlFormat } from '../../types/StatusState';
import { isParentKiosk } from '../Kiosk/KioskActions';
import { isTempoService, TempoUrlProvider } from '../../utils/tracing/UrlProviders/Tempo';
import { isJaegerService, JaegerUrlProvider } from '../../utils/tracing/UrlProviders/Jaeger';
import { DiscoveryTracingConfig } from './DiscoveryTracingConfig';

type TraceConfigurationModalProps = {
  cluster: string;
  isOpen: boolean;
  onClose: () => void;
};

export const validateExternalUrl = (
  externalServices: ExternalServiceInfo[],
  kiosk: string,
  info?: TracingInfo
): string | undefined => {
  const svc = externalServices.find(s => s.name === info?.provider);
  if (!svc) return `"View in Tracing" link is hidden because external_url is not defined (No service found)`;

  if (isParentKiosk(kiosk)) {
    return 'kiosk mode detected. kiosk will try to use the Distributed Tracing UI link. In case the configuration is not found, it will use the external_url.';
  }

  if (isTempoService(svc)) {
    if (svc.tempoConfig?.urlFormat === TempoUrlFormat.JAEGER) {
      const urlProvider = new JaegerUrlProvider(svc);
      if (!urlProvider.HomeUrl() || !urlProvider.valid) {
        return '"View in Tracing" is hidden because external_url is empty';
      }
    } else if (svc.tempoConfig?.urlFormat === TempoUrlFormat.OPENSHIFT) {
      const urlProvider = new TempoUrlProvider(svc, externalServices);
      if (!urlProvider.HomeUrl() || !urlProvider.valid) {
        return '"View in Tracing" is hidden because external_url is empty or invalid for OpenShift console';
      }
    } else {
      const urlProvider = new TempoUrlProvider(svc, externalServices);
      if (!urlProvider.HomeUrl() || !urlProvider.valid) {
        return "\"View in Tracing\" link is hidden because Grafana is not enabled. To use external_url as 'View in tracing' link, tempo_config.url_format must be set to 'jaeger' or 'openshift'";
      }
    }
  }
  if (isJaegerService(svc)) {
    const urlProvider = new JaegerUrlProvider(svc);
    if (!urlProvider.HomeUrl() || !urlProvider.valid) {
      return '"View in Tracing" is hidden because external_url is empty';
    }
  }

  return undefined;
};

export const TraceConfigurationModal: React.FC<TraceConfigurationModalProps> = ({ cluster, isOpen, onClose }) => {
  const { t } = useKialiTranslation();

  if (!isOpen) {
    return null;
  }

  const title = t('Configuration Discovery');
  const checkConfigHelp = (
    <>
      {t(
        'Check the usual ports for the tracing service and provide a subset of the tracing configuration based on the tracing services found for external_services.tracing.'
      )}
      <br />
      {t(
        'While the health check is simple and checks only for an HTTP 200 response for the URL, this check is more comprehensive and attempts to validate the returned trace data. It will typically use the internal_url to perform the checks. If Kiali is running outside of the cluster, the external_url will be used.'
      )}
    </>
  );

  return (
    <Modal
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={onClose}
      data-test="modal-tracing-discovery"
      title={title}
      help={
        <Popover headerContent={title} bodyContent={checkConfigHelp}>
          <Button variant={ButtonVariant.plain} aria-label={t('Help')} icon={<HelpIcon />} />
        </Popover>
      }
      actions={[
        <Button key="close" onClick={onClose}>
          {t('Close')}
        </Button>
      ]}
    >
      <DiscoveryTracingConfig cluster={cluster} />
    </Modal>
  );
};
