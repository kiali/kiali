import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { TargetPanelCommonProps, renderNodeHeader, targetPanelStyle } from './TargetPanelCommon';
import { MeshNodeData, isExternal } from 'types/Mesh';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { t } from 'utils/I18nUtils';

type TargetPanelNodeProps = TargetPanelCommonProps;

export const TargetPanelNode: React.FC<TargetPanelNodeProps> = (props: TargetPanelNodeProps) => {
  const node = props.target.elem as Node<NodeModel, any>;

  if (!node) {
    return null;
  }

  const data = node.getData() as MeshNodeData;

  return (
    <div id="target-panel-node" className={classes(panelStyle, targetPanelStyle)}>
      <div className={panelHeadingStyle}>{renderNodeHeader(data, { nameOnly: isExternal(data.cluster) })}</div>
      <div className={panelBodyStyle}>
        <div style={{ textAlign: 'left' }}>{`${t('Version')}: ${data.version || t('unknown')}`}</div>
        <span>{`${t('Configuration')}:`}</span>
        <pre>{JSON.stringify(data.infraData, null, 2)}</pre>
      </div>
    </div>
  );
};
