import * as React from 'react';
import { Visualization } from '@patternfly/react-topology';
import { renderInfraSummary, TargetPanelCommonProps, targetPanelStyle } from './TargetPanelCommon';
import { classes } from 'typestyle';
import { panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';

type TargetPanelMeshProps = TargetPanelCommonProps;

const targetPanelTitle = kialiStyle({
  fontWeight: 'bolder',
  marginTop: '0.25rem',
  marginBottom: '0.25rem',
  textAlign: 'left'
});

export const TargetPanelMesh: React.FC<TargetPanelMeshProps> = (props: TargetPanelMeshProps) => {
  const { t } = useKialiTranslation();

  const controller = props.target.elem as Visualization;

  if (!controller) {
    return null;
  }

  return (
    <div id="target-panel-mesh" className={classes(panelStyle, targetPanelStyle)}>
      <div id="target-panel-mesh-heading" className={panelHeadingStyle}>
        <div className={targetPanelTitle}>
          {t('Mesh: {{name}}', { name: controller.getGraph().getData().meshData.name })}
          <br />
        </div>
      </div>

      {renderInfraSummary(controller)}
    </div>
  );
};
