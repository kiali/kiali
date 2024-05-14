import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { getKialiTheme } from 'utils/ThemeUtils';
import {
  TargetPanelCommonProps,
  renderNodeHeader,
  shouldRefreshData,
  targetPanelStyle,
  targetPanelWidth
} from './TargetPanelCommon';
import { kialiIconDark, kialiIconLight } from 'config';
import { KialiInstance, MeshNodeData, isExternal } from 'types/Mesh';
import { Theme } from 'types/Common';
import { PromisesRegistry } from 'utils/CancelablePromises';
import * as API from '../../../services/Api';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import { ApiError } from 'types/Api';
import { KialiIcon } from 'config/KialiIcon';
import { Title, TitleSizes, Tooltip } from '@patternfly/react-core';
import { classes } from 'typestyle';
import { descendents } from '../MeshElems';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { t } from 'utils/I18nUtils';

type TargetPanelClusterProps = TargetPanelCommonProps;

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

export class TargetPanelCluster extends React.Component<TargetPanelClusterProps, TargetPanelClusterState> {
  static readonly panelStyle = {
    backgroundColor: PFColors.BackgroundColor100,
    height: '100%',
    margin: 0,
    minWidth: targetPanelWidth,
    overflowY: 'auto' as 'auto',
    width: targetPanelWidth
  };

  private promises = new PromisesRegistry();

  constructor(props: TargetPanelClusterProps) {
    super(props);

    const clusterNode = this.props.target.elem as Node<NodeModel, any>;
    this.state = { ...defaultState, clusterNode: clusterNode };
  }

  static getDerivedStateFromProps: React.GetDerivedStateFromProps<TargetPanelCommonProps, TargetPanelClusterState> = (
    props: TargetPanelCommonProps,
    state: TargetPanelClusterState
  ) => {
    // if the target (i.e. clusterBox) has changed, then init the state
    return props.target.elem !== state.clusterNode
      ? ({ clusterNode: props.target.elem, loading: true } as TargetPanelClusterState)
      : null;
  };

  componentDidMount(): void {
    this.load();
  }

  componentDidUpdate(prevProps: TargetPanelClusterProps): void {
    if (shouldRefreshData(prevProps, this.props)) {
      this.load();
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  render(): React.ReactNode {
    if (this.state.loading || !this.state.clusterNode) {
      return null;
    }

    const data = this.state.clusterNode.getData() as MeshNodeData;
    const clusterData = data.infraData ?? {
      accessible: false,
      isKialiHome: false,
      name: data.infraName
    };
    const version = data.version;

    return (
      <div id="target-panel-cluster" className={classes(panelStyle, targetPanelStyle)}>
        <div id="target-panel-cluster-heading" className={panelHeadingStyle}>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            {clusterData.isKialiHome && (
              <Tooltip content={t('Kiali home cluster')}>
                <span style={{ marginRight: '0.5rem' }}>
                  <KialiIcon.Star />
                </span>
              </Tooltip>
            )}
            <PFBadge badge={PFBadges.Cluster} size="global" />
            {clusterData.name}
          </Title>
        </div>
        {isExternal(data.cluster) ? (
          <div className={panelBodyStyle}>
            {descendents(this.state.clusterNode)
              .sort((n1, n2) => {
                const name1 = (n1.getData() as MeshNodeData).infraName.toLowerCase();
                const name2 = (n2.getData() as MeshNodeData).infraName.toLowerCase();
                return name1 < name2 ? -1 : 1;
              })
              .map(n => {
                return renderNodeHeader(n.getData() as MeshNodeData, true, true);
              })}
          </div>
        ) : (
          <div className={panelBodyStyle}>
            {clusterData.accessible && this.renderKialiLinks(clusterData.kialiInstances)}
            {version && (
              <>
                {`${t('Version')}: ${version}`}
                <br />
              </>
            )}
            {`${t('Network')}: ${clusterData.network || t('n/a')}`}
            <br />
            {`${t('API Endpoint')}: ${clusterData.apiEndpoint || t('n/a')}`}
            <br />
            {`${t('Secret Name')}: ${clusterData.secretName || t('n/a')}`}
          </div>
        )}
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

  private renderKialiLinks = (kialiInstances: KialiInstance[]): React.ReactNode => {
    const kialiIcon = getKialiTheme() === Theme.DARK ? kialiIconDark : kialiIconLight;
    return kialiInstances?.map(instance => {
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
