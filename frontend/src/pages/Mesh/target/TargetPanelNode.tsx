import * as React from 'react';
import {
  TargetPanelCommonProps,
  renderNodeHeader,
  targetBodyStyle,
  targetPanelHR,
  targetPanelStyle
} from './TargetPanelCommon';
import { MeshNodeData, NodeTarget, isExternal, MeshInfraType } from 'types/Mesh';
import { classes } from 'typestyle';
import { panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { useKialiTranslation } from 'utils/I18nUtils';
import { UNKNOWN } from 'types/Graph';
import { TargetPanelEditor } from './TargetPanelEditor';
import * as API from '../../../services/Api';
import { StatusError } from '../../../types/TracingInfo';
import { Validation } from '../../../components/Validations/Validation';
import { ValidationTypes } from '../../../types/IstioObjects';

type TargetPanelNodeProps<T extends MeshNodeData> = TargetPanelCommonProps & {
  target: NodeTarget<T>;
};

export const TargetPanelNode: React.FC<TargetPanelNodeProps<MeshNodeData>> = (
  props: TargetPanelNodeProps<MeshNodeData>
) => {
  const { t } = useKialiTranslation();
  const [loading, setLoading] = React.useState(false);
  const [diagnostic, setDiagnostic] = React.useState<StatusError | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchCheckService = async (): Promise<void> => {
    setLoading(true);
    setDiagnostic(null);
    setError(null);

    return API.getDiagnoseStatus(data.cluster)
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

  const node = props.target;

  if (!node) {
    return null;
  }

  const data = node.elem.getData()!;

  return (
    <div id="target-panel-node" className={classes(panelStyle, targetPanelStyle)}>
      <div className={panelHeadingStyle}>{renderNodeHeader(data, { nameOnly: isExternal(data.cluster) })}</div>
      <div className={targetBodyStyle}>
        <span>{t('Version: {{version}}', { version: data.version || t(UNKNOWN) })}</span>

        {targetPanelHR}

        <TargetPanelEditor configData={data.infraData} targetName={data.infraName}></TargetPanelEditor>
        {data.infraType === MeshInfraType.TRACE_STORE && (
          <>
            {targetPanelHR}
            <div>
              <button onClick={handleCheckService} disabled={loading}>
                {loading ? 'Verifying...' : 'Diagnose'}
              </button>
              {diagnostic && !error && (
                <span style={{ marginLeft: '0.5rem' }}>
                  <Validation severity={ValidationTypes.Correct} />
                </span>
              )}
              {diagnostic && <p style={{ color: 'green' }}>{diagnostic.msg}</p>}
              {error && <p style={{ color: 'red' }}>{error}</p>}
              {diagnostic?.validConfig && (
                <ul>
                  {diagnostic?.validConfig?.map(item => (
                    <span>
                      <li>Namespace selector: {item.namespaceSelector.toString()}</li>
                      <li>Provider: {item.provider}</li>
                      <li>Internal URL: {item.url}</li>
                      <li>Use gRPC: {item.useGRPC.toString()}</li>
                    </span>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
