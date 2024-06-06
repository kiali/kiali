import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { TargetPanelCommonProps, renderNodeHeader, targetPanelStyle } from './TargetPanelCommon';
import { MeshNodeData, isExternal } from 'types/Mesh';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { useKialiTranslation } from 'utils/I18nUtils';
import { UNKNOWN } from 'types/Graph';
import { TargetPanelConfigTable } from './TargetPanelConfigTable';

type TargetPanelNodeProps = TargetPanelCommonProps;

export const TargetPanelNode: React.FC<TargetPanelNodeProps> = (props: TargetPanelNodeProps) => {
  const { t } = useKialiTranslation();

  const node = props.target.elem as Node<NodeModel, any>;

  if (!node) {
    return null;
  }

  const data = node.getData() as MeshNodeData;

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
