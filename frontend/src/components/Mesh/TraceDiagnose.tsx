import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { targetPanelHR } from '../../pages/Mesh/target/TargetPanelCommon';
import { Validation } from '../Validations/Validation';
import { ValidationTypes } from '../../types/IstioObjects';
import { StatusError } from '../../types/TracingInfo';
import * as API from '../../services/Api';
import { kialiStyle } from 'styles/StyleUtils';
import { LogsModal } from './LogsModal';

interface TracingDiagnoseProps {
  cluster: string;
}

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

export const TracingDiagnose: React.FC<TracingDiagnoseProps> = (props: TracingDiagnoseProps) => {
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
                    <span className={blockDisplay}>
                      <span className={blueDisplay}>namespace_selector:</span> {item.namespaceSelector.toString()}
                    </span>
                    <span className={blockDisplay}>
                      <span className={blueDisplay}>provider:</span> {item.provider}
                    </span>
                    <span className={blockDisplay}>
                      <span className={blueDisplay}>internal_url:</span> {item.url}
                    </span>
                    <span className={blockDisplay}>
                      <span className={blueDisplay}>use_grpc:</span> {item.useGRPC.toString()}
                    </span>
                    {item.warning && <span style={{ color: 'red' }}>{item.warning}</span>}
                  </div>
                  {diagnostic?.validConfig && i < diagnostic?.validConfig?.length - 1 && <hr />}
                </>
              ))}
            </div>
          </>
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
