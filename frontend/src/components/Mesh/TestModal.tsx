import * as React from 'react';
import { TracingCheck, TracingInfo } from '../../types/TracingInfo';
import { Button, Modal, ModalVariant, Tab, TabAction } from '@patternfly/react-core';
import { kialiStyle } from '../../styles/StyleUtils';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { PFColors } from '../Pf/PfColors';
import { ExternalServiceInfo, TempoUrlFormat } from '../../types/StatusState';
import { isParentKiosk } from '../Kiosk/KioskActions';
import { isTempoService, TempoUrlProvider } from '../../utils/tracing/UrlProviders/Tempo';
import { isJaegerService, JaegerUrlProvider } from '../../utils/tracing/UrlProviders/Jaeger';
import { KialiAppState } from '../../store/Store';
import { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { TracingActions } from '../../actions/TracingActions';
import { connect } from 'react-redux';
import { classes } from 'typestyle';
import { basicTabStyle } from '../../styles/TabStyles';
import { ParameterizedTabs } from '../Tab/Tabs';
import { CheckConfig } from './CheckConfig';
import { TestConfig } from './TestConfig';
import { HelpIcon } from '@patternfly/react-icons';
import { helpPopover } from '../../pages/Mesh/target/TargetPanelControlPlane';

type ReduxProps = {
  externalServices: ExternalServiceInfo[];
  kiosk: string;
  tracingDiagnose?: TracingCheck;
  tracingInfo?: TracingInfo;
};

type ReduxDispatchProps = {
  setTracingDiagnose: (err?: TracingCheck) => void;
};

type TestModalProps = ReduxProps &
  ReduxDispatchProps & {
    cluster: string;
    configData: unknown;
    isOpen: boolean;
    onClose: () => void;
  };

const modalStyle = kialiStyle({
  overflowY: 'hidden',
  height: '800px'
});

const tabStyle = kialiStyle({
  $nest: {
    '&& .pf-v5-c-tabs__list': {
      marginLeft: 0
    }
  }
});

export const helpStyle = kialiStyle({
  marginBottom: '0.6em',
  marginLeft: '0.375rem',
  $nest: {
    '&:hover': {
      color: PFColors.Color200,
      cursor: 'pointer'
    }
  }
});

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

export const TestModalComp: React.FC<TestModalProps> = (props: TestModalProps) => {
  const { t } = useKialiTranslation();

  const [currentTab, setCurrentTab] = React.useState(defaultTab);

  const checkConfigHelp = (
    <>
      {t(
        'Check the usual ports for the tracing service and provide a subset of the tracing configuration based on the tracing services found for external_services.tracing.'
      )}
      <br />
      {t(
        'While the health check is based on whether the URL response returns an HTTP 200, the services check performs a more exhaustive verification by attempting to analyze if the traces response is correct. It is important that internal_url is defined, as it relies on this host to perform the checks. When in_cluster config is false, it will use the external_url'
      )}
    </>
  );

  const testConfigHelp = (
    <>
      {t('Test the configuration without having to modify the CR.')}
      <br />
      {t("Changes done in this section won't be saved")}
    </>
  );

  const renderTabs = (): React.ReactNode[] => {
    const ref = React.createRef<HTMLElement>();
    const refTest = React.createRef<HTMLElement>();
    const checkConfig = (
      <Tab
        eventKey={0}
        title={t('Check Config')}
        key="checkConfig"
        actions={
          <>
            <TabAction aria-label={`Help action for Check config`} ref={ref}>
              <HelpIcon />
            </TabAction>
            {helpPopover(t('Check Status'), checkConfigHelp, ref)}
          </>
        }
      >
        <CheckConfig cluster={props.cluster} />
      </Tab>
    );

    const testConfig = (
      <Tab
        eventKey={1}
        title={t('Test Configuration')}
        key="testConfig"
        actions={
          <>
            <TabAction aria-label={`Help action for Test config`} ref={refTest}>
              <HelpIcon />
            </TabAction>
            {helpPopover(t('Test Status'), testConfigHelp, refTest)}
          </>
        }
      >
        <TestConfig configData={props.configData} />
      </Tab>
    );

    return [checkConfig, testConfig];
  };

  if (!props.isOpen) {
    return null;
  }

  return (
    <Modal
      className={modalStyle}
      variant={ModalVariant.medium}
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={t('Tracing configuration')}
      actions={[
        <Button key="close" onClick={props.onClose}>
          {t('Close')}
        </Button>
      ]}
    >
      <ParameterizedTabs
        id="basic-tabs"
        className={classes(basicTabStyle, tabStyle)}
        onSelect={tabValue => {
          setCurrentTab(tabValue);
        }}
        tabMap={tabIndex}
        defaultTab={defaultTab}
        activeTab={currentTab}
        mountOnEnter={false}
        unmountOnExit={true}
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
    tracingDiagnose: state.tracingState.diagnose,
    tracingInfo: state.tracingState.info
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setTracingDiagnose: bindActionCreators(TracingActions.setDiagnose, dispatch)
});

export const TestModal = connect(mapStateToProps, mapDispatchToProps)(TestModalComp);
