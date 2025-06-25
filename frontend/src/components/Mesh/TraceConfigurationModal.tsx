import * as React from 'react';
import { TracingCheck, TracingInfo } from '../../types/TracingInfo';
import { Button, Modal, ModalVariant, Tab, TabAction } from '@patternfly/react-core';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { ExternalServiceInfo, TempoUrlFormat } from '../../types/StatusState';
import { isParentKiosk } from '../Kiosk/KioskActions';
import { isTempoService, TempoUrlProvider } from '../../utils/tracing/UrlProviders/Tempo';
import { isJaegerService, JaegerUrlProvider } from '../../utils/tracing/UrlProviders/Jaeger';
import { KialiAppState } from '../../store/Store';
import { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { TracingActions } from '../../actions/TracingActions';
import { connect } from 'react-redux';
import { ParameterizedTabs } from '../Tab/Tabs';
import { DiscoveryTracingConfig } from './DiscoveryTracingConfig';
import { CheckerTracingConfig } from './CheckerTracingConfig';
import { HelpIcon } from '@patternfly/react-icons';
import { helpPopover } from '../../pages/Mesh/target/TargetPanelControlPlane';

type ReduxProps = {
  externalServices: ExternalServiceInfo[];
  kiosk: string;
  tracingCheck?: TracingCheck;
  tracingInfo?: TracingInfo;
};

type ReduxDispatchProps = {
  setTracingDiagnose: (err?: TracingCheck) => void;
};

type TraceConfigurationModalProps = ReduxProps &
  ReduxDispatchProps & {
    cluster: string;
    configData: unknown;
    isOpen: boolean;
    onClose: () => void;
  };

const defaultTab = 'checkConfig';

const tabIndex: { [tab: string]: number } = {
  checkConfig: 0,
  testConfig: 1
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
    if (svc.tempoConfig?.url_format === TempoUrlFormat.JAEGER) {
      const urlProvider = new JaegerUrlProvider(svc);
      if (!urlProvider.HomeUrl() || !urlProvider.valid) {
        return '"View in Tracing" is hidden because external_url is empty';
      }
    } else {
      const urlProvider = new TempoUrlProvider(svc, externalServices);
      if (!urlProvider.HomeUrl() || !urlProvider.valid) {
        return "\"View in Tracing\" link is hidden because Grafana is not enabled. To use external_url as 'View in tracing' link, tempo_config.url_format must be set to 'jaeger'";
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

export const TraceConfigurationModalComp: React.FC<TraceConfigurationModalProps> = (
  props: TraceConfigurationModalProps
) => {
  const { t } = useKialiTranslation();

  const [currentTab, setCurrentTab] = React.useState(defaultTab);

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

  const testConfigHelp = (
    <>
      {t('Edit and test configuration changes without having to modify the CR.')}
      <br />
      {t(
        'Changes here are not saved to the Kiali CR. If happy with changes, update the Kiali CR using your standard change workflow.'
      )}
    </>
  );

  const renderTabs = (): React.ReactNode[] => {
    const ref = React.createRef<HTMLElement>();
    const refTest = React.createRef<HTMLElement>();
    const checkConfig = (
      <Tab
        eventKey={0}
        title={t('Discovery')}
        key="checkConfig"
        actions={
          <>
            <TabAction aria-label={`Help action for Check config`} ref={ref}>
              <HelpIcon />
            </TabAction>
            {helpPopover(t('Configuration Discovery'), checkConfigHelp, ref)}
          </>
        }
      >
        <DiscoveryTracingConfig cluster={props.cluster} />
      </Tab>
    );

    const testConfig = (
      <Tab
        eventKey={1}
        title={t('Tester')}
        key="testConfig"
        actions={
          <>
            <TabAction aria-label={`Help action for configuration test`} ref={refTest}>
              <HelpIcon />
            </TabAction>
            {helpPopover(t('Configuration Tester'), testConfigHelp, refTest)}
          </>
        }
      >
        <CheckerTracingConfig configData={props.configData} />
      </Tab>
    );

    return [checkConfig, testConfig];
  };

  if (!props.isOpen) {
    return null;
  }

  return (
    <Modal
      variant={ModalVariant.medium}
      isOpen={props.isOpen}
      onClose={props.onClose}
      data-test="modal-configuration-tester"
      title={t('Configuration Tester')}
      actions={[
        <Button key="close" onClick={props.onClose}>
          {t('Close')}
        </Button>
      ]}
    >
      <ParameterizedTabs
        id="basic-tabs"
        onSelect={tabValue => {
          setCurrentTab(tabValue);
        }}
        tabMap={tabIndex}
        defaultTab={defaultTab}
        activeTab={currentTab}
        mountOnEnter={false}
        unmountOnExit={false}
      >
        {renderTabs()}
      </ParameterizedTabs>
    </Modal>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    externalServices: state.statusState.externalServices,
    kiosk: state.globalState.kiosk,
    tracingCheck: state.tracingState.diagnose,
    tracingInfo: state.tracingState.info
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setTracingDiagnose: bindActionCreators(TracingActions.setDiagnose, dispatch)
});

export const TraceConfigurationModal = connect(mapStateToProps, mapDispatchToProps)(TraceConfigurationModalComp);
