import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import {
  Button,
  ButtonVariant,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Spinner,
  Title
} from '@patternfly/react-core';
import { kialiStyle } from '../../styles/StyleUtils';
import { PFSpacer } from '../../styles/PfSpacer';
import type { TracingCheck, TracingInfo, TracingProbeResult } from '../../types/TracingInfo';
import { PFColors } from '../Pf/PfColors';
import * as API from '../../services/Api';
import type { ExternalServiceInfo } from '../../types/StatusState';
import { TempoUrlFormat } from '../../types/StatusState';
import { isParentKiosk } from '../Kiosk/KioskActions';
import { isTempoService, TempoUrlProvider } from '../../utils/tracing/UrlProviders/Tempo';
import { isJaegerService, JaegerUrlProvider } from '../../utils/tracing/UrlProviders/Jaeger';
import type { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { TracingActions } from '../../actions/TracingActions';
import { connect } from 'react-redux';
import type { KialiAppState } from '../../store/Store';
import { classes } from 'typestyle';
import { contrastOverlayNest } from 'styles/ThemeSurfaces';

type ReduxProps = {
  externalServices: ExternalServiceInfo[];
  kiosk: string;
  tracingDiagnose?: TracingCheck;
  tracingInfo?: TracingInfo;
};

type ReduxDispatchProps = {
  setTracingDiagnose: (err?: TracingCheck) => void;
};

type CheckModalProps = ReduxDispatchProps &
  ReduxProps & {
    cluster: string;
    externalServices: ExternalServiceInfo[];
    kiosk: string;
    tracingDiagnose?: TracingCheck;
    tracingInfo?: TracingInfo;
  };

const backendCheckStyle = kialiStyle({ marginBottom: PFSpacer.md });

const configStyle = kialiStyle({
  fontFamily: 'Courier New, Courier, monospace',
  fontSize: 'small',
  marginBottom: '0.75em'
});

const blockDisplay = kialiStyle({
  display: 'block'
});

const containerStyle = kialiStyle({
  fontFamily: 'Courier New, Courier, monospace',
  fontSize: 'small',
  resize: 'none',
  whiteSpace: 'pre',
  width: '100%',
  overflowX: 'scroll',
  backgroundColor: PFColors.BackgroundColor100,
  border: `1px solid ${PFColors.BorderColor100}`,
  borderRadius: '6px',
  padding: '1rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  $nest: contrastOverlayNest()
});

const blueDisplay = kialiStyle({
  color: PFColors.LightBlue500
});

const padding = kialiStyle({
  padding: '0 0.5em'
});

const greyDisplay = kialiStyle({
  padding: '0 0.5em'
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

export const CheckConfigComp: React.FC<CheckModalProps> = (props: CheckModalProps) => {
  const { t } = useKialiTranslation();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const externalUrl = validateExternalUrl(props.externalServices, props.kiosk, props.tracingInfo);
  const readiness = props.tracingDiagnose?.readiness;
  const queryAPI = props.tracingDiagnose?.queryAPI;

  const formatReadiness = (result: TracingProbeResult): string => {
    if (result.status === 'passed') {
      return t('Ready');
    }

    if (result.status === 'unverified') {
      return t('Unverified. The readiness endpoint requires authentication.');
    }

    return result.httpStatus ? t('Failed (HTTP {{status}})', { status: result.httpStatus }) : t('Failed');
  };

  const labels = {
    namespaceSelector: 'NamespaceSelector',
    provider: 'Provider',
    url: 'InternalUrl',
    useGRPC: 'UseGRPC'
  };

  const fetchCheckService = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    return API.getDiagnoseStatus(props.cluster)
      .then(response => {
        props.setTracingDiagnose(response.data);
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
        const errString = err.response.data.error ? err.response.data.error : err;
        setError(`${errString}`);
      });
  };

  const handleCheckService = async (): Promise<void> => {
    fetchCheckService();
  };

  React.useEffect(() => {
    if (!props.tracingDiagnose) {
      fetchCheckService();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id="tracing-discovery-content"
      style={{ display: 'flex', flexDirection: 'column', height: '600px', paddingTop: '1em' }}
    >
      <div style={{ flexGrow: 1, overflowY: 'auto' }}>
        {props.tracingDiagnose && (
          <>
            <span style={{ color: 'green' }}>{props.tracingDiagnose.message}</span>
            {!loading && !error && (readiness || queryAPI) && (
              <section className={backendCheckStyle} aria-live="polite">
                <Title headingLevel="h4" size="lg">
                  {t('Deployed tracing backend')}
                </Title>
                <DescriptionList isHorizontal isCompact>
                  {readiness && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Readiness')}</DescriptionListTerm>
                      <DescriptionListDescription data-test="tracing-readiness-result">
                        {formatReadiness(readiness)}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  {queryAPI && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Tracing query API')}</DescriptionListTerm>
                      <DescriptionListDescription data-test="tracing-query-result">
                        {queryAPI.status === 'passed' ? t('Verified') : t('Failed')}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                </DescriptionList>
              </section>
            )}
            <div style={{ marginTop: '1em' }}>
              <span>{t('Possible configuration(s) found for external_services.tracing')}:</span>
            </div>
          </>
        )}
        {error && (
          <div>
            <span style={{ color: 'red' }}>{error}</span>
          </div>
        )}
        {props.tracingDiagnose?.validConfig && (
          <>
            <div style={{ margin: '0.5em 0', display: 'flex' }}>
              <span>
                {props.tracingDiagnose?.validConfig.length === 0 && <>No configurations found. See logs for details</>}
              </span>
            </div>
            <div id="valid-configurations">
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
                  {props.tracingDiagnose?.validConfig && i < props.tracingDiagnose?.validConfig?.length - 1 && (
                    <div style={{ padding: '0 0 10px 5px' }}>---</div>
                  )}
                </>
              ))}
            </div>
          </>
        )}
        {props.tracingDiagnose?.validConfig && externalUrl && (
          <div>
            <span className={configStyle}>{externalUrl}</span>
          </div>
        )}
        {props.tracingDiagnose?.logLine && (
          <>
            <div style={{ margin: '1em 0' }}>
              <Title headingLevel="h4" size="lg" style={{ paddingBottom: '10px' }}>
                {t('Logs')}:
              </Title>
              <div className={containerStyle} id={'configuration-logs'}>
                {props.tracingDiagnose.logLine.map(log => (
                  <>
                    <div>
                      <span>
                        <span className={greyDisplay}>{log.time.substring(0, 19)}</span>
                        <span className={classes(blueDisplay, padding)}>[{log.test}]</span>
                        {log.result}
                      </span>
                    </div>
                  </>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <div>
        <Button
          onClick={handleCheckService}
          disabled={loading}
          variant={ButtonVariant.secondary}
          style={{ marginRight: '5px' }}
        >
          {t('Rediscover')}
        </Button>
        {loading && <Spinner id="discover-spinner" size="sm" />}
      </div>
    </div>
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

export const DiscoveryTracingConfig = connect(mapStateToProps, mapDispatchToProps)(CheckConfigComp);
