import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { NodeAttr } from 'types/Graph';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { getKialiTheme } from 'utils/ThemeUtils';
import {
  TargetPanelCommonProps,
  getTitle,
  targetPanel,
  targetPanelHeading,
  targetPanelWidth
} from './TargetPanelCommon';
import { kialiIconDark, kialiIconLight, serverConfig } from 'config';
import { KialiInstance } from 'types/Mesh';
import { Theme } from 'types/Common';

type TargetPanelClusterBoxState = {
  clusterBox: any;
};

const defaultState: TargetPanelClusterBoxState = {
  clusterBox: null
};

const kialiIconStyle = kialiStyle({
  width: '1rem',
  marginRight: '0.25rem'
});

export class TargetPanelClusterBox extends React.Component<TargetPanelCommonProps, TargetPanelClusterBoxState> {
  static readonly panelStyle = {
    backgroundColor: PFColors.BackgroundColor100,
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

  static getDerivedStateFromProps(
    props: TargetPanelCommonProps,
    state: TargetPanelClusterBoxState
  ): TargetPanelClusterBoxState | null {
    // if the target (i.e. mesh) has changed, then init the state
    return props.target.elem !== state.clusterBox ? { clusterBox: props.target.elem } : null;
  }

  render() {
    const clusterBox = this.props.target.elem as Node<NodeModel, any>;
    const data = clusterBox.getData();
    // const boxed = descendents(clusterBox);
    const cluster = data[NodeAttr.cluster];
    const kialiInstances = serverConfig.clusters[cluster] ? serverConfig.clusters[cluster].kialiInstances : [];

    return (
      <div className={targetPanel} style={TargetPanelClusterBox.panelStyle}>
        <div className={targetPanelHeading}>
          {getTitle('Cluster')}
          {this.renderCluster(cluster, kialiInstances)}
        </div>
      </div>
    );
  }

  private renderCluster = (cluster: string, kialiInstances: KialiInstance[]): React.ReactNode => {
    return (
      <React.Fragment key={cluster}>
        <PFBadge badge={PFBadges.Cluster} size="sm" style={{ marginBottom: '0.125rem' }} />
        {cluster}
        <br />
        {this.renderKialiLinks(kialiInstances)}
      </React.Fragment>
    );
  };

  private renderKialiLinks = (kialiInstances: KialiInstance[]): React.ReactNode => {
    const kialiIcon = getKialiTheme() === Theme.DARK ? kialiIconDark : kialiIconLight;
    return kialiInstances.map(instance => {
      if (instance.url.length !== 0) {
        return (
          <span>
            <img alt="Kiali Icon" src={kialiIcon} className={kialiIconStyle} />
            <a href={instance.url} target="_blank" rel="noopener noreferrer">
              {instance.namespace} {' / '} {instance.serviceName}
            </a>
            <br />
          </span>
        );
      } else {
        return (
          <span>
            <img alt="Kiali Icon" src={kialiIcon} className={kialiIconStyle} />
            {`${instance.namespace} / ${instance.serviceName}`}
            <br />
          </span>
        );
      }
    });
  };
}
