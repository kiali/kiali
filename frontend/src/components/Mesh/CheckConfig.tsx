import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { Button, ButtonVariant, Popover, PopoverPosition } from '@patternfly/react-core';
import { KialiIcon } from '../../config/KialiIcon';
import { helpStyle, validateExternalUrl } from './TestModal';
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
  margin: '1.25em'
});

const blockDisplay = kialiStyle({
  display: 'block'
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

export const CheckConfigComp: React.FC<CheckModalProps> = (props: CheckModalProps) => {
  const { t } = useKialiTranslation();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const externalUrl = validateExternalUrl(props.externalServices, props.kiosk, props.tracingInfo);
  const labels = {
    namespaceSelector: 'namespace_selector',
    provider: 'provider',
    url: 'internal_url',
    useGRPC: 'use_grpc'
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

  return (
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

export const CheckConfig = connect(mapStateToProps, mapDispatchToProps)(CheckConfigComp);
