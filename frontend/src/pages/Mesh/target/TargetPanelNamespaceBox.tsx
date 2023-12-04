import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { TargetPanelCommonProps, getTitle, targetPanelStyle, targetPanelWidth } from './TargetPanelCommon';
import { targetPanelHeadingStyle } from './TargetPanelStyle';
import { NodeAttr } from 'types/Graph';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';

type TargetPanelNamespaceBoxState = {
  loading: boolean;
  namespaceBox: any;
};

const defaultState: TargetPanelNamespaceBoxState = {
  loading: false,
  namespaceBox: null
};

const namespaceStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

export class TargetPanelNamespaceBox extends React.Component<TargetPanelCommonProps, TargetPanelNamespaceBoxState> {
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

  static getDerivedStateFromProps(props: TargetPanelCommonProps, state: TargetPanelNamespaceBoxState) {
    // if the target (i.e. namespaceBox) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.namespaceBox ? { namespaceBox: props.target.elem, loading: true } : null;
  }

  componentDidMount() {}

  componentDidUpdate(_prevProps: TargetPanelCommonProps) {}

  componentWillUnmount() {}

  render() {
    const namespaceBox = this.props.target.elem as Node<NodeModel, any>;
    const data = namespaceBox.getData();
    // const boxed = descendents(namespaceBox);
    const namespace = data[NodeAttr.namespace];

    return (
      <div className={targetPanelStyle} style={TargetPanelNamespaceBox.panelStyle}>
        <div className={targetPanelHeadingStyle}>{getTitle('Namespace')}</div>
        {this.renderNamespace(namespace)}
      </div>
    );
  }

  private renderNamespace = (ns: string): React.ReactNode => {
    return (
      <React.Fragment key={ns}>
        <span className={namespaceStyle}>
          <PFBadge badge={PFBadges.Namespace} size="sm" style={{ marginBottom: '0.125rem' }} />
          {ns}{' '}
        </span>
        <br />
      </React.Fragment>
    );
  };
}
