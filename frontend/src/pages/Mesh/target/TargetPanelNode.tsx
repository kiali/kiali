import * as React from 'react';
import { TargetPanelCommonProps, renderNodeHeader, targetPanelStyle } from './TargetPanelCommon';
import { MeshNodeData, NodeTarget, isExternal } from 'types/Mesh';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { useKialiTranslation } from 'utils/I18nUtils';
import { UNKNOWN } from 'types/Graph';
import { TargetPanelConfigTable } from './TargetPanelConfigTable';

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
      <div className={panelBodyStyle}>
        <span>{t('Version: {{version}}', { version: data.version || t(UNKNOWN) })}</span>

        <TargetPanelConfigTable configData={data.infraData} targetName={data.infraName} width="40%" />
      </div>
    </div>
  );
};
