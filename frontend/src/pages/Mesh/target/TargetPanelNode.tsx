import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import {
  TargetPanelCommonProps,
  getTitle,
  renderNode,
  targetPanelStyle,
  targetPanelHeading,
  targetPanelWidth
} from './TargetPanelCommon';
import { MeshAttr } from 'types/Mesh';

type TargetPanelNodeState = {
  loading: boolean;
  node: any;
};

const defaultState: TargetPanelNodeState = {
  loading: false,
  node: null
};

export class TargetPanelNode extends React.Component<TargetPanelCommonProps, TargetPanelNodeState> {
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

  static getDerivedStateFromProps = (
    props: TargetPanelCommonProps,
    state: TargetPanelNodeState
  ): TargetPanelNodeState | null => {
    // if the target (i.e. node) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.node ? { node: props.target.elem, loading: true } : null;
  };

  componentDidMount = (): void => {};

  componentDidUpdate = (_prevProps: TargetPanelCommonProps): void => {};

  componentWillUnmount = (): void => {};

  render = (): React.ReactNode => {
    const node = this.props.target.elem as Node<NodeModel, any>;
    const data = node.getData();
    const name = data[MeshAttr.infraName];
    const type = data[MeshAttr.infraType];

    return (
      <div className={targetPanelStyle} style={TargetPanelNode.panelStyle}>
        <div className={targetPanelHeading}>{getTitle('Infra')}</div>
        <div style={{ marginBottom: '0.125rem' }}>{renderNode(name, type)}</div>
      </div>
    );
  };
}
