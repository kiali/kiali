import * as React from 'react';
import { Visualization } from '@patternfly/react-topology';
import { TargetPanelCommonProps, getTitle, targetPanelStyle, targetPanelWidth } from './TargetPanelCommon';
import { targetPanelHeadingStyle } from './TargetPanelStyle';

type TargetPanelMeshState = {
  loading: boolean;
  mesh: any;
};

const defaultState: TargetPanelMeshState = {
  mesh: null,
  loading: false
};

export class TargetPanelMesh extends React.Component<TargetPanelCommonProps, TargetPanelMeshState> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: targetPanelWidth,
    overflowY: 'auto' as 'auto',
    width: targetPanelWidth
  };

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
      <div id="target-panel-mesh" className={targetPanelStyle} style={TargetPanelMesh.panelStyle}>
        <div id="summary-panel-graph-heading" className={targetPanelHeadingStyle}>
          {getTitle('Current Mesh')}
        </div>
      </div>
    );
  }
}
