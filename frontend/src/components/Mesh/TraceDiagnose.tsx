import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { targetPanelHR } from '../../pages/Mesh/target/TargetPanelCommon';
import { Validation } from '../Validations/Validation';
import { ValidationTypes } from '../../types/IstioObjects';
import { StatusError, TracingInfo } from '../../types/TracingInfo';
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

type ReduxProps = {
  externalServices: ExternalServiceInfo[];
  kiosk: string;
  tracingInfo?: TracingInfo;
};

type TracingDiagnoseProps = ReduxProps & {
  cluster: string;
  config: MeshNodeData;
};

const codeStyle = kialiStyle({
  fontFamily: 'Courier New, Courier, monospace'
});

const configStyle = kialiStyle({
  fontFamily: 'Courier New, Courier, monospace',
  margin: '2em'
});

const blockDisplay = kialiStyle({
  display: 'block'
});

const blueDisplay = kialiStyle({
  color: 'rgb(25 116 116);'
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
        return '"View in Tracing" link is hidden because external_url is empty';
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
    console.log(urlProvider);
    if (!urlProvider.HomeUrl() || !urlProvider.valid) {
      return '"View in Tracing" link is hidden because external_url is empty';
    }
  }

  return undefined;
};

export const TracingDiagnoseComp: React.FC<TracingDiagnoseProps> = (props: TracingDiagnoseProps) => {
  const fetchCheckService = async (): Promise<void> => {
    setLoading(true);
    setDiagnostic(null);
    setError(null);

    return API.getDiagnoseStatus(props.cluster)
      .then(response => {
        setDiagnostic(response.data);
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

  const { t } = useKialiTranslation();
  const [loading, setLoading] = React.useState(false);
  const [diagnostic, setDiagnostic] = React.useState<StatusError | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const externalUrl = validateExternalUrl(props.externalServices, props.kiosk, props.tracingInfo);
  const labels = {
    namespaceSelector: 'namespace_selector',
    provider: 'provider',
    url: 'url',
    useGRPC: 'use_grpc'
  };

  return (
    <>
      {targetPanelHR}
      <div>
        <button onClick={handleCheckService} disabled={loading}>
          {loading ? t('Verifying...') : t('Diagnose')}
        </button>
        {diagnostic && !error && (
          <span style={{ marginLeft: '0.5rem' }}>
            <Validation severity={ValidationTypes.Correct} />
          </span>
        )}
        {diagnostic && <span style={{ color: 'green' }}>{diagnostic.message}</span>}
        {error && (
          <div>
            <span style={{ color: 'red' }}>{error}</span>
          </div>
        )}
        {diagnostic?.validConfig && (
          <>
            <div style={{ margin: '1em 0' }}>
              <span>
                Possible configuration(s) found for <span className={codeStyle}>external_services.tracing</span>:
              </span>
            </div>
            <div>
              {diagnostic?.validConfig?.map((item, i) => (
                <>
                  <div className={configStyle}>
                    {Object.keys(item).map(key => {
                      if (labels[key] !== undefined) {
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
                  {diagnostic?.validConfig && i < diagnostic?.validConfig?.length - 1 && <hr />}
                </>
              ))}
            </div>
          </>
        )}
        {diagnostic?.logLine && externalUrl && (
          <div>
            <span style={{ color: 'red' }}>{externalUrl}</span>
          </div>
        )}
        {diagnostic?.logLine && (
          <>
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                setIsModalOpen(true);
              }}
            >
              {t('More info...')}
            </a>
            <LogsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} logs={diagnostic?.logLine} />
          </>
        )}
      </div>
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    externalServices: state.statusState.externalServices,
    kiosk: state.globalState.kiosk,
    tracingInfo: state.tracingState.info
  };
};

export const TracingDiagnose = connect(mapStateToProps)(TracingDiagnoseComp);
