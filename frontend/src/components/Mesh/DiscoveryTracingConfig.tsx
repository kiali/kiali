import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { Button, ButtonVariant, Spinner, Title } from '@patternfly/react-core';
import { validateExternalUrl } from './TraceConfigurationModal';
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
import { classes } from 'typestyle';

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
  backgroundColor: PFColors.BackgroundColor100,
  border: '1px solid #ddd',
  borderRadius: '6px',
  padding: '1rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
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
      fetchCheckService();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div
      id="discovery-tab-content"
      style={{ display: 'flex', flexDirection: 'column', height: '600px', paddingTop: '1em' }}
    >
      <div style={{ flexGrow: 1, overflowY: 'auto' }}>
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
