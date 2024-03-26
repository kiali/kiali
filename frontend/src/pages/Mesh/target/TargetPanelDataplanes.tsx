import * as React from 'react';
import { Node, NodeModel, Visualization } from '@patternfly/react-topology';
import {
  TargetPanelCommonProps,
  getTitle,
  targetPanel,
  targetPanelBody,
  targetPanelBorder,
  targetPanelHeading
} from './TargetPanelCommon';
import { classes } from 'typestyle';

type TargetPanelDataplanesState = {
  dataplanesNode?: Node<NodeModel, any>;
  loading: boolean;
};

const defaultState: TargetPanelDataplanesState = {
  dataplanesNode: undefined,
  loading: false
};

export class TargetPanelDataplanes extends React.Component<TargetPanelCommonProps, TargetPanelDataplanesState> {
  constructor(props: TargetPanelCommonProps) {
    super(props);

    const dataplanesNode = this.props.target.elem as Node<NodeModel, any>;
    this.state = { ...defaultState, dataplanesNode: dataplanesNode };
  }

  render() {
    const controller = this.props.target.elem as Visualization;

    if (!controller) {
      return null;
    }

    let text: string;
    const numDataplanes = this.state.dataplanesNode?.getChildren().length;
    if (numDataplanes === 1) {
      text = '1 dataplane namespace';
    } else {
      text = `${numDataplanes} dataplane namespaces`;
    }

    return (
      <div id="target-panel-dataplanes" className={classes(targetPanelBorder, targetPanel)}>
        <div id="target-panel-dataplanes-heading" className={targetPanelHeading}>
          {getTitle('Dataplane Namespaces')}
        </div>
        <div className={targetPanelBody}>
          <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>{text}</div>
        </div>
      </div>
    );
  }
}
