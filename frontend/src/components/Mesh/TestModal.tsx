import * as React from 'react';
import { TracingCheck, TracingInfo } from '../../types/TracingInfo';
import { Button, ButtonVariant, Modal, ModalVariant, Popover, PopoverPosition, Tab } from '@patternfly/react-core';
import { kialiStyle } from '../../styles/StyleUtils';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { PFColors } from '../Pf/PfColors';
import { KialiIcon } from '../../config/KialiIcon';
import * as API from '../../services/Api';
import { ExternalServiceInfo, TempoUrlFormat } from '../../types/StatusState';
import { isParentKiosk } from '../Kiosk/KioskActions';
import { isTempoService, TempoUrlProvider } from '../../utils/tracing/UrlProviders/Tempo';
import { isJaegerService, JaegerUrlProvider } from '../../utils/tracing/UrlProviders/Jaeger';
import { KialiAppState } from '../../store/Store';
import { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { TracingActions } from '../../actions/TracingActions';
import { connect } from 'react-redux';
import AceEditor from 'react-ace';
import { getKialiTheme } from 'utils/ThemeUtils';
import { Theme } from '../../types/Common';
import { istioAceEditorStyle } from '../../styles/AceEditorStyle';
import { aceOptions, yamlDumpOptions } from '../../types/IstioConfigDetails';
import ReactAce from 'react-ace/lib/ace';
import { classes } from 'typestyle';
import { basicTabStyle } from '../../styles/TabStyles';
import { ParameterizedTabs } from '../Tab/Tabs';
import { dump } from 'js-yaml';

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
    isOpen: boolean;
    onClose: () => void;
  };

const modalStyle = kialiStyle({
  overflowY: 'hidden'
});

const containerStyle = kialiStyle({
  backgroundColor: PFColors.Black1000,
  color: PFColors.Blue100,
  fontFamily: 'Courier New, Courier, monospace',
  margin: 0,
  padding: '0.5em',
  resize: 'none',
  whiteSpace: 'pre',
  width: '100%',
  overflowX: 'scroll'
});

const blueDisplay = kialiStyle({
  color: PFColors.Blue400
});

const blueDarkDisplay = kialiStyle({
  color: PFColors.Blue200,
  padding: '0 0.5em'
});

const tabStyle = kialiStyle({
  $nest: {
    '&& .pf-v5-c-tabs__list': {
      marginLeft: 0
    }
  }
});

const helpStyle = kialiStyle({
  marginBottom: '0.6em',
  marginLeft: '0.375rem',
  $nest: {
    '&:hover': {
      color: PFColors.Color200,
      cursor: 'pointer'
    }
  }
});

const configStyle = kialiStyle({
  fontFamily: 'Courier New, Courier, monospace',
  fontSize: 'small',
  margin: '1.25em'
});

const blockDisplay = kialiStyle({
  display: 'block'
});

const defaultTab = 'checkConfig';

const tabIndex: { [tab: string]: number } = {
  checkConfig: 0,
  testConfig: 1
};

const validateExternalUrl = (
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
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const labels = {
    namespaceSelector: 'namespace_selector',
    provider: 'provider',
    url: 'internal_url',
    useGRPC: 'use_grpc'
  };
  const externalUrl = validateExternalUrl(props.externalServices, props.kiosk, props.tracingInfo);
  const aceEditorRef = React.useRef<ReactAce | null>(null);
  const [currentTab, setCurrentTab] = React.useState(defaultTab);

  const renderTabs = (): React.ReactNode[] => {
    const checkConfig = (
      <Tab eventKey={0} title={t('Check Config')} key="checkConfig">
        <div style={{ paddingTop: '0.5em' }}>
          <div>
            <span style={{ paddingTop: '0.25em' }}>
              {t('Check for possible configuration(s) of external_services.tracing')}
            </span>
            <Popover
              data-test="check-status-help"
              position={PopoverPosition.auto}
              headerContent={
                <div>
                  <span>{t('Check Status')}</span>
                </div>
              }
              bodyContent={
                <>
                  {t(
                    'Check the usual ports for the tracing service and provide a subset of the tracing configuration based on the tracing services found for external_services.tracing.'
                  )}
                  <br />
                  {t(
                    'While the health check is based on whether the URL response returns an HTTP 200, the services check performs a more exhaustive verification by attempting to analyze if the traces response is correct. It is important that internal_url is defined, as it relies on this host to perform the checks. When in_cluster config is false, it will use the external_url'
                  )}
                </>
              }
            >
              <KialiIcon.Help className={helpStyle} />
            </Popover>
          </div>
          <div style={{ display: 'flex' }}>
            <Button onClick={handleCheckService} disabled={loading} variant={ButtonVariant.secondary}>
              {loading ? t('Verifying...') : t('Check Status')}
            </Button>
            {props.tracingDiagnose && (
              <span style={{ position: 'absolute', right: '2.4em' }}>
                <Button
                  variant={ButtonVariant.link}
                  aria-label={t('Close')}
                  isInline
                  onClick={() => props.setTracingDiagnose()}
                >
                  <KialiIcon.Close />
                </Button>
              </span>
            )}
          </div>
          {props.tracingDiagnose && <span style={{ color: 'green' }}>{props.tracingDiagnose.message}</span>}
          {error && (
            <div>
              <span style={{ color: 'red' }}>{error}</span>
            </div>
          )}
          {props.tracingDiagnose?.validConfig && (
            <>
              <div style={{ margin: '0.5em 0', display: 'flex' }}>
                <span>
                  {props.tracingDiagnose?.validConfig.length === 0 && (
                    <>No configurations found. See logs for details</>
                  )}
                </span>
              </div>
              <div>
                {props.tracingDiagnose?.validConfig?.map((item, i) => (
                  <>
                    <div className={configStyle}>
                      {Object.keys(item).map(key => {
                        if (labels[key] !== undefined && item[key] != null) {
                          return (
                            <span className={blockDisplay}>
                              <span className={blueDisplay}>{labels[key]}:</span> {item[key].toString()}
                            </span>
                          );
                        }
                        return null;
                      })}
                      {item.warning && <span style={{ color: 'red' }}>{item.warning}</span>}
                    </div>
                    {props.tracingDiagnose?.validConfig && i < props.tracingDiagnose?.validConfig?.length - 1 && <hr />}
                  </>
                ))}
              </div>
            </>
          )}
          {props.tracingDiagnose?.logLine && externalUrl && (
            <div>
              <span className={configStyle}>{externalUrl}</span>
            </div>
          )}
          {props.tracingDiagnose?.logLine && (
            <div className={containerStyle}>
              {props.tracingDiagnose.logLine.map(log => (
                <>
                  <div>
                    <span>
                      <span className={blueDisplay}>{log.time.substring(0, 19)}</span>
                      <span className={blueDarkDisplay}>[{log.test}]</span>
                      {log.result}
                    </span>
                  </div>
                </>
              ))}
            </div>
          )}
        </div>
      </Tab>
    );

    const theme = getKialiTheme();

    const getConfigToString = dump(props.tracingInfo, {
      noRefs: true,
      skipInvalid: true,
      ...yamlDumpOptions
    });

    const testConfig = (
      <Tab eventKey={1} title={t('Test Configuration')} key="testConfig">
        <div style={{ paddingTop: '10px' }}>
          <span>
            {t('external_services.tracing configuration:')}{' '}
            <Popover
              data-test="check-status-help"
              position={PopoverPosition.auto}
              headerContent={
                <div>
                  <span>Check Status</span>
                </div>
              }
              bodyContent={
                <>
                  {t(
                    'Check the usual ports for the tracing service and provide a subset of the tracing configuration based on the tracing services found for external_services.tracing.'
                  )}
                  <br />
                  {t(
                    'While the health check is based on whether the URL response returns an HTTP 200, the services check performs a more exhaustive verification by attempting to analyze if the traces response is correct. It is important that internal_url is defined, as it relies on this host to perform the checks. When in_cluster config is false, it will use the external_url'
                  )}
                </>
              }
            >
              <KialiIcon.Help className={helpStyle} />
            </Popover>
          </span>
          <AceEditor
            ref={aceEditorRef}
            mode="yaml"
            theme={theme === Theme.DARK ? 'twilight' : 'eclipse'}
            width="100%"
            className={istioAceEditorStyle}
            wrapEnabled={true}
            readOnly={false}
            setOptions={aceOptions ?? { foldStyle: 'markbegin' }}
            value={getConfigToString}
          />
          <Button style={{ marginTop: '10px' }} variant={ButtonVariant.secondary}>
            Test Config
          </Button>
        </div>
      </Tab>
    );

    return [checkConfig, testConfig];
  };

  const fetchCheckService = async (): Promise<void> => {
    setLoading(true);
    props.setTracingDiagnose();
    setError(null);

    return API.getDiagnoseStatus(props.cluster)
      .then(response => {
        props.setTracingDiagnose(response.data);
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
        setError(`Could not fetch diagnose info ${err}`);
      });
  };

  const handleCheckService = async (): Promise<void> => {
    fetchCheckService();
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
        mountOnEnter={true}
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
