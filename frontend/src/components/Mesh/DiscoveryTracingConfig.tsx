import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { Button, ButtonVariant, Spinner, Title } from '@patternfly/react-core';
import { validateExternalUrl } from './ConfigurationTesterModal';
import { kialiStyle } from '../../styles/StyleUtils';
import { TracingCheck, TracingInfo } from '../../types/TracingInfo';
import { PFColors } from '../Pf/PfColors';
import * as API from '../../services/Api';
import { ExternalServiceInfo } from '../../types/StatusState';
import { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { TracingActions } from '../../actions/TracingActions';
import { connect } from 'react-redux';
import { KialiAppState } from '../../store/Store';

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
  backgroundColor: '#f8f9fa',
  border: '1px solid #ddd',
  borderRadius: '6px',
  padding: '1rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
});

const blueDisplay = kialiStyle({
  color: '#2A9292'
});

const greyDisplay = kialiStyle({
  color: PFColors.Black600,
  padding: '0 0.5em'
});

export const CheckConfigComp: React.FC<CheckModalProps> = (props: CheckModalProps) => {
  const { t } = useKialiTranslation();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const externalUrl = validateExternalUrl(props.externalServices, props.kiosk, props.tracingInfo);

  const labels = {
    namespaceSelector: 'NamespaceSelector',
    provider: 'Provider',
    url: 'InternalUrl',
    useGRPC: 'UseGRPC'
  };

  React.useEffect(() => {
    if (!props.tracingDiagnose) {
      console.log('Fetch service');
      fetchCheckService();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setError(`${errString}`);
      });
  };

  const handleCheckService = async (): Promise<void> => {
    fetchCheckService();
  };

  return (
    <div style={{ paddingTop: '1em', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {props.tracingDiagnose && (
        <>
          <span style={{ color: 'green' }}>{props.tracingDiagnose.message}</span>
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
            <div className={containerStyle}>
              {props.tracingDiagnose.logLine.map(log => (
                <>
                  <div>
                    <span>
                      <span className={blueDisplay}>{log.time.substring(0, 19)}</span>
                      <span className={greyDisplay}>[{log.test}]</span>
                      {log.result}
                    </span>
                  </div>
                </>
              ))}
            </div>
          </div>
        </>
      )}
      <div style={{ marginTop: 'auto' }}>
        <Button onClick={handleCheckService} disabled={loading} variant={ButtonVariant.secondary}>
          {t('Rediscover')}
        </Button>
        {loading && <Spinner size="sm" />}
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
