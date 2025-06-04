import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { TracingCheck, TracingInfo } from '../../types/TracingInfo';
import * as API from '../../services/Api';
import { kialiStyle } from 'styles/StyleUtils';
import { LogsModal } from './LogsModal';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { ExternalServiceInfo, TempoUrlFormat } from '../../types/StatusState';
import { isJaegerService, JaegerUrlProvider } from '../../utils/tracing/UrlProviders/Jaeger';
import { isTempoService, TempoUrlProvider } from '../../utils/tracing/UrlProviders/Tempo';
import { isParentKiosk } from '../Kiosk/KioskActions';
import { MeshNodeData } from '../../types/Mesh';
import { KialiIcon } from 'config/KialiIcon';
import { Button, ButtonVariant, Popover, PopoverPosition } from '@patternfly/react-core';
import { PFColors } from '../Pf/PfColors';
import { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { TracingActions } from '../../actions/TracingActions';
import { TestConfig } from './TestConfig';

type ReduxProps = {
  externalServices: ExternalServiceInfo[];
  kiosk: string;
  tracingDiagnose?: TracingCheck;
  tracingInfo?: TracingInfo;
};

type ReduxDispatchProps = {
  setTracingDiagnose: (err?: TracingCheck) => void;
};

type TracingDiagnoseProps = ReduxProps &
  ReduxDispatchProps & {
    cluster: string;
    config: MeshNodeData;
  };

const configStyle = kialiStyle({
  fontFamily: 'Courier New, Courier, monospace',
  fontSize: 'small',
  margin: '1.25em'
});

const blockDisplay = kialiStyle({
  display: 'block'
});

const blueDisplay = kialiStyle({
  color: 'rgb(25 116 116);'
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

export const TracingDiagnoseComp: React.FC<TracingDiagnoseProps> = (props: TracingDiagnoseProps) => {
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
        const errString = err.response.data.error ? err.response.data.error : err;
        setError(`Could not fetch diagnose info ${errString}`);
      });
  };

  const handleCheckService = async (): Promise<void> => {
    fetchCheckService();
  };

  const { t } = useKialiTranslation();
  const [loading, setLoading] = React.useState(false);
  //const [diagnostic, setDiagnostic] = React.useState<StatusError | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [isTestModalOpen, setIsTestModalOpen] = React.useState<boolean>(false);
  const externalUrl = validateExternalUrl(props.externalServices, props.kiosk, props.tracingInfo);
  const labels = {
    authType: 'auth.type',
    namespaceSelector: 'namespace_selector',
    provider: 'provider',
    url: 'internal_url',
    useGRPC: 'use_grpc'
  };
  return (
    <>
      <div style={{ paddingTop: '0.25em' }}>
        <div>
          <span style={{ paddingTop: '0.25em' }}>Status</span>
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
        </div>
        <div style={{ display: 'flex' }}>
          <Button onClick={handleCheckService} disabled={loading} variant={ButtonVariant.secondary}>
            {loading ? t('Verifying...') : t('Check Status')}
          </Button>
          <Button
            style={{ marginLeft: '5px' }}
            onClick={() => setIsTestModalOpen(true)}
            variant={ButtonVariant.secondary}
          >
            Test Config
          </Button>
          <TestConfig isOpen={isTestModalOpen} onClose={() => setIsTestModalOpen(false)} />
          {props.tracingDiagnose && (
            <span style={{ position: 'absolute', right: '1em' }}>
              <Button
                variant={ButtonVariant.link}
                aria-label={t('Close')}
                isInline
                onClick={() => props.setTracingDiagnose()}
              >
                <KialiIcon.Close />
                <span>{t('Close')}</span>
              </Button>
            </span>
          )}
        </div>
        {props.tracingDiagnose && <span style={{ color: 'green' }}>{props.tracingDiagnose.message}</span>}
        {error && (
          <div>
            <span style={{ color: 'red' }}>{props.tracingDiagnose?.error ? props.tracingDiagnose?.error : error}</span>
          </div>
        )}
        {props.tracingDiagnose?.validConfig && (
          <>
            <div style={{ margin: '0.5em 0', display: 'flex' }}>
              <span>
                {props.tracingDiagnose?.validConfig.length > 0 && (
                  <>{t('Possible configuration(s) found for external_services.tracing')}:</>
                )}
                {props.tracingDiagnose?.validConfig.length === 0 && <>No configurations found. See logs for details</>}
              </span>
            </div>
            <div>
              {props.tracingDiagnose?.validConfig?.map((item, i) => (
                <>
                  <div className={configStyle}>
                    {Object.keys(item).map(key => {
                      if (labels[key] !== undefined && item[key] !== null) {
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
          <div style={{ paddingTop: '1em' }}>
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                setIsModalOpen(true);
              }}
            >
              {t('View logs')}
            </a>
            <LogsModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              logs={props.tracingDiagnose?.logLine}
            />
          </div>
        )}
      </div>
    </>
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

export const TracingDiagnose = connect(mapStateToProps, mapDispatchToProps)(TracingDiagnoseComp);
