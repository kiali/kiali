import * as React from 'react';
import { Controller } from '@patternfly/react-topology';
import { renderInfraSummary, TargetPanelCommonProps, targetPanelStyle } from './TargetPanelCommon';
import { classes } from 'typestyle';
import { panelStyle } from 'pages/Graph/SummaryPanelStyle';

type TargetPanelMeshProps = TargetPanelCommonProps;

export const TargetPanelMesh: React.FC<TargetPanelMeshProps> = (props: TargetPanelMeshProps) => {
  const controller = props.target.elem as Controller;

  if (!controller) {
    return null;
  }

  return (
    <div id="target-panel-mesh" className={classes(panelStyle, targetPanelStyle)}>
      {renderInfraSummary(controller, props.meshData)}
    </div>
  );
};
