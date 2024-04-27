import * as React from 'react';
import { Visualization } from '@patternfly/react-topology';
import {
  TargetPanelCommonProps,
  getTitle,
  targetPanel,
  targetPanelBorder,
  targetPanelHeading
} from './TargetPanelCommon';
import { classes } from 'typestyle';

type TargetPanelMeshState = {
  loading: boolean;
  mesh: any;
};

const defaultState: TargetPanelMeshState = {
  mesh: null,
  loading: false
};

export class TargetPanelMesh extends React.Component<TargetPanelCommonProps, TargetPanelMeshState> {
  constructor(props: TargetPanelCommonProps) {
    super(props);

    this.state = { ...defaultState };
  }

  static getDerivedStateFromProps(props: TargetPanelCommonProps, state: TargetPanelMeshState) {
    // if the target (i.e. mesh) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.mesh ? { graph: props.target.elem, loading: true } : null;
  }

  componentDidMount() {}

  componentDidUpdate(_prevProps: TargetPanelCommonProps) {}

  componentWillUnmount() {}

  render() {
    const controller = this.props.target.elem as Visualization;

    if (!controller) {
      return null;
    }

    return (
      <div id="target-panel-mesh" className={classes(targetPanelBorder, targetPanel)}>
        <div id="target-panel-mesh-heading" className={targetPanelHeading}>
          {getTitle(`Mesh Name: ${controller.getGraph().getData().meshData.name}`)}
        </div>
      </div>
    );
  }
}
