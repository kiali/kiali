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
import { TracingDiagnose } from '../../../components/Mesh/TraceDiagnose';

type TargetPanelNodeProps<T extends MeshNodeData> = TargetPanelCommonProps & {
  target: NodeTarget<T>;
};

export const TargetPanelNode: React.FC<TargetPanelNodeProps<MeshNodeData>> = (
  props: TargetPanelNodeProps<MeshNodeData>
) => {
  const { t } = useKialiTranslation();

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
        {data.infraType === MeshInfraType.TRACE_STORE && (
          <TracingDiagnose cluster={data.cluster} configData={data.infraData} />
        )}
        {targetPanelHR}

        <TargetPanelEditor configData={data.infraData} targetName={data.infraName}></TargetPanelEditor>
      </div>
    </div>
  );
};
