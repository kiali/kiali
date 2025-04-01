import * as React from 'react';
import {
  TargetPanelCommonProps,
  renderNodeHeader,
  targetBodyStyle,
  targetPanelHR,
  targetPanelStyle
} from './TargetPanelCommon';
import { MeshNodeData, NodeTarget, isExternal } from 'types/Mesh';
import { classes } from 'typestyle';
import { panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { useKialiTranslation } from 'utils/I18nUtils';
import { UNKNOWN } from 'types/Graph';
import { TargetPanelEditor } from './TargetPanelEditor';
import { ResourceUsageMetricsMap } from '../../../types/Metrics';
import { TargetPanelControlPlaneMetrics } from './TargetPanelControlPlaneMetrics';
import * as API from '../../../services/Api';
import * as AlertUtils from '../../../utils/AlertUtils';
import { computePrometheusRateParams } from '../../../services/Prometheus';
import { IstioMetricsOptions } from '../../../types/MetricsOptions';
import { serverConfig } from '../../../config';

type TargetPanelMetricsProps<T extends MeshNodeData> = TargetPanelCommonProps & {
  target: NodeTarget<T>;
};

export const TargetPanelMetrics: React.FC<TargetPanelMetricsProps<MeshNodeData>> = (
  props: TargetPanelMetricsProps<MeshNodeData>
) => {
  const { t } = useKialiTranslation();

  const node = props.target;
  const [metrics, setMetrics] = React.useState<ResourceUsageMetricsMap>();

  const fetchMetrics = async (): Promise<void> => {
    const rateParams = computePrometheusRateParams(props.duration, 10);
    const options: IstioMetricsOptions = {
      direction: 'outbound',
      duration: props.duration,
      filters: ['request_count', 'request_error_count'],
      includeAmbient: serverConfig.ambientEnabled,
      rateInterval: rateParams.rateInterval,
      reporter: 'source',
      step: rateParams.step
    };

    const data = props.target.elem.getData();

    return API.getResourceUsageMetrics(
      data?.namespace ? data.namespace : '',
      data?.infraName ? data.infraName : '',
      options,
      data?.cluster
    )
      .then(response => {
        const controlPlaneMetrics: ResourceUsageMetricsMap = {
          cpu_usage: response.data.cpu_usage,
          memory_usage: response.data.memory_usage
        };
        setMetrics(controlPlaneMetrics);
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch component metrics.', error);
        throw error;
      });
  };

  React.useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.duration, props.target.elem]);

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
        <TargetPanelControlPlaneMetrics
          key={data.namespace}
          istiodContainerMemory={metrics?.memory_usage}
          istiodContainerCpu={metrics?.cpu_usage}
          type={data.infraName}
        />
        {targetPanelHR}

        <TargetPanelEditor configData={data.infraData} targetName={data.infraName}></TargetPanelEditor>
      </div>
    </div>
  );
};
