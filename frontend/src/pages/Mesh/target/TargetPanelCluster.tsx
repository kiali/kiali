import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { getKialiTheme } from 'utils/ThemeUtils';
import {
  TargetPanelCommonProps,
  getTitle,
  shouldRefreshData,
  targetPanel,
  targetPanelHR,
  targetPanelHeading,
  targetPanelWidth
} from './TargetPanelCommon';
import { kialiIconDark, kialiIconLight } from 'config';
import { KialiInstance, MeshAttr, MeshCluster } from 'types/Mesh';
import { Theme } from 'types/Common';
import { PromisesRegistry } from 'utils/CancelablePromises';
import * as API from '../../../services/Api';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import { ApiError } from 'types/Api';
import { KialiIcon } from 'config/KialiIcon';
import { Tooltip } from '@patternfly/react-core';

type TargetPanelClusterState = {
  clusterNode?: Node<NodeModel, any>;
  loading: boolean;
};

const defaultState: TargetPanelClusterState = {
  clusterNode: undefined,
  loading: false
};

const kialiIconStyle = kialiStyle({
  width: '1rem',
  marginRight: '0.25rem'
});

export class TargetPanelCluster extends React.Component<TargetPanelCommonProps, TargetPanelClusterState> {
  static readonly panelStyle = {
    backgroundColor: PFColors.BackgroundColor100,
    height: '100%',
    margin: 0,
    minWidth: targetPanelWidth,
    overflowY: 'auto' as 'auto',
    width: targetPanelWidth
  };

  // private cluster: string;
  private meshCluster: MeshCluster;
  private promises = new PromisesRegistry();

  constructor(props: TargetPanelCommonProps) {
    super(props);

    const clusterNode = this.props.target.elem as Node<NodeModel, any>;
    // this.cluster = clusterNode.getData()[NodeAttr.cluster];
    this.meshCluster = clusterNode.getData()[MeshAttr.infraData];
    this.state = { ...defaultState, clusterNode };
  }

  static getDerivedStateFromProps(
    props: TargetPanelCommonProps,
    state: TargetPanelClusterState
  ): TargetPanelClusterState | null {
    // if the target (i.e. clusterBox) has changed, then init the state
    return props.target.elem !== state.clusterNode
      ? ({ clusterNode: props.target.elem, loading: true } as TargetPanelClusterState)
      : null;
  }

  componentDidMount() {
    this.load();
  }

  componentDidUpdate(prevProps: TargetPanelCommonProps) {
    if (shouldRefreshData(prevProps, this.props)) {
      this.load();
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  render() {
    return (
      <div className={targetPanel} style={TargetPanelCluster.panelStyle}>
        <div className={targetPanelHeading}>
          {getTitle('Cluster')}
          {this.renderCluster(this.meshCluster)}
        </div>
      </div>
    );
  }

  private load = (): void => {
    this.promises.cancelAll();

    // TODO: Do we have anything to load for the cluster side panel?
    Promise.resolve()
      .then(_result => {
        this.setState({ loading: false });
      })
      .catch(err => {
        if (err.isCanceled) {
          console.debug('TargetPanelCluster: Ignore fetch error (canceled).');
          return;
        }

        this.setState({ ...defaultState, loading: false });
        this.handleApiError('Could not fetch cluster when loading target panel', err);
      });

    this.setState({ loading: true });
  };

  private handleApiError(message: string, error: ApiError): void {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  }

  private renderCluster = (meshCluster: MeshCluster): React.ReactNode => {
    return (
      <React.Fragment key={meshCluster.name}>
        <span>
          {meshCluster.isKialiHome && (
            <Tooltip content="Kiali home cluster">
              <KialiIcon.Star />
            </Tooltip>
          )}
          <PFBadge badge={PFBadges.Cluster} size="sm" style={{ marginLeft: '0.225rem', marginBottom: '0.125rem' }} />
          {meshCluster.name}
        </span>
        {targetPanelHR()}
        {this.renderKialiLinks(meshCluster.kialiInstances)}
        {`Network: `}
        {meshCluster.network ? meshCluster.network : 'n/a'}
        <br />
        {`API Endpoint: `}
        {meshCluster.apiEndpoint ? meshCluster.apiEndpoint : 'n/a'}
        <br />
        {`Secret Name: `}
        {meshCluster.secretName ? meshCluster.secretName : 'n/a'}
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
