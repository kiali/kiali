import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { TargetPanelCommonProps, shouldRefreshData, targetPanelHR, targetPanelStyle } from './TargetPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import {
  Card,
  CardBody,
  CardHeader,
  Label,
  List,
  ListItem,
  Title,
  TitleSizes,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { Paths, serverConfig } from 'config';
import { ValidationStatus } from 'types/IstioObjects';
import { OverviewNamespaceAction, OverviewNamespaceActions } from 'pages/Overview/OverviewNamespaceActions';
import { NamespaceInfo, NamespaceStatus } from 'types/NamespaceInfo';
import { NamespaceMTLSStatus } from 'components/MTls/NamespaceMTLSStatus';
import { NamespaceStatuses } from 'pages/Overview/NamespaceStatuses';
import { DirectionType, OverviewType } from 'pages/Overview/OverviewToolbar';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { ControlPlaneDonut } from 'pages/Overview/ControlPlaneDonut';
import { isParentKiosk, kioskOverviewAction } from 'components/Kiosk/KioskActions';
import { Show } from 'pages/Overview/OverviewPage';
import { ControlPlaneVersionBadge } from 'pages/Overview/ControlPlaneVersionBadge';
import { AmbientBadge } from 'components/Ambient/AmbientBadge';
import { PFColors } from 'components/Pf/PfColors';
import { ValidationSummaryLink } from 'components/Link/ValidationSummaryLink';
import { ValidationSummary } from 'components/Validations/ValidationSummary';
import { OverviewCardDataPlaneNamespace } from 'pages/Overview/OverviewCardDataPlaneNamespace';
import * as API from '../../../services/Api';
import { IstioMetricsOptions } from 'types/MetricsOptions';
import { computePrometheusRateParams } from 'services/Prometheus';
import { ApiError } from 'types/Api';
import { DEGRADED, FAILURE, HEALTHY, Health, NOT_READY } from 'types/Health';
import { router } from '../../../app/History';
import * as AlertUtils from '../../../utils/AlertUtils';
import { MessageType } from 'types/MessageCenter';
import { OverviewStatus } from 'pages/Overview/OverviewStatus';
import { switchType } from 'pages/Overview/OverviewHelper';
import { TLSStatus } from 'types/TLSStatus';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import { Metric } from 'types/Metrics';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { isRemoteCluster } from './TargetPanelControlPlane';
import { BoxTarget, ControlPlane, NamespaceNodeData } from 'types/Mesh';
import { MeshInfraType } from 'types/Mesh';

type TargetPanelNamespaceProps = TargetPanelCommonProps & {
  target: BoxTarget<NamespaceNodeData>;
};

type TargetPanelNamespaceState = {
  controlPlanes?: ControlPlane[];
  errorMetrics?: Metric[];
  loading: boolean;
  metrics?: Metric[];
  nsInfo?: NamespaceInfo;
  status?: NamespaceStatus;
  targetCluster: string;
  targetNamespace: string;
  targetNode: Node<NodeModel, NamespaceNodeData>;
  tlsStatus?: TLSStatus;
};

const defaultState = {
  errorMetrics: undefined,
  loading: false,
  nsInfo: undefined,
  status: undefined,
  tlsStatus: undefined
};

// TODO: Should these remain fixed values?
const healthType: OverviewType = 'app';
const direction: DirectionType = 'outbound';

const cardGridStyle = kialiStyle({
  textAlign: 'center',
  marginTop: 0,
  marginBottom: '0.5rem',
  boxShadow: 'none'
});

const namespaceNameStyle = kialiStyle({
  display: 'block',
  textAlign: 'left',
  overflow: 'hidden',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis'
});

export class TargetPanelNamespace extends React.Component<TargetPanelNamespaceProps, TargetPanelNamespaceState> {
  private promises = new PromisesRegistry();

  constructor(props: TargetPanelNamespaceProps) {
    super(props);

    const targetNode = this.props.target.elem;

    const data = targetNode.getData()!;

    this.state = {
      ...defaultState,
      controlPlanes: this.getControlPlanes(),
      targetCluster: data.cluster,
      targetNamespace: data.namespace,
      targetNode: targetNode
    };
  }

  static getDerivedStateFromProps(
    props: TargetPanelNamespaceProps,
    state: TargetPanelNamespaceState
  ): TargetPanelNamespaceState | null {
    // if the target (e.g. namespaceBox) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    if (props.target.elem !== state.targetNode) {
      const { cluster, namespace } = props.target.elem.getData()!;
      return {
        controlPlanes: state.controlPlanes,
        targetNode: props.target.elem,
        targetCluster: cluster,
        targetNamespace: namespace,
        nsInfo: state.nsInfo,
        loading: true
      };
    }

    return null;
  }

  componentDidMount(): void {
    this.load();
  }

  componentDidUpdate(prevProps: TargetPanelCommonProps): void {
    if (shouldRefreshData(prevProps, this.props)) {
      this.load();
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  render(): React.ReactNode {
    if (!this.state.nsInfo) {
      return this.state.loading ? this.getLoading() : <></>;
    }

    const listItemStyle = { marginTop: 0 };
    const isControlPlane = this.isControlPlane();
    const nsInfo = this.state.nsInfo;
    const ns = nsInfo.name;
    const actions = this.getNamespaceActions();
    const namespaceActions = (
      <OverviewNamespaceActions key={`namespaceAction_${ns}`} namespace={ns} actions={actions} />
    );

    return (
      <div className={classes(panelStyle, targetPanelStyle)}>
        <Card id="target-panel-namespace" isCompact={true} className={cardGridStyle} data-test={`${ns}-mesh-target`}>
          <CardHeader
            className={panelHeadingStyle}
            actions={{ actions: <>{namespaceActions}</>, hasNoOffset: false, className: undefined }}
          >
            <Title headingLevel="h5" size={TitleSizes.lg}>
              <span className={namespaceNameStyle}>
                <span>
                  <PFBadge badge={PFBadges.Namespace} />
                  {ns}
                </span>

                {this.renderNamespaceBadges(nsInfo, true)}
              </span>
            </Title>

            <div style={{ textAlign: 'left', paddingBottom: 3 }}>
              <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} />
              {nsInfo.cluster}
            </div>
          </CardHeader>
          <CardBody className={panelBodyStyle}>
            {isControlPlane && !isRemoteCluster(nsInfo.annotations) && (
              <>
                {this.renderLabels(nsInfo)}

                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'inline-block', width: '125px' }}>Istio config</div>

                  {this.props.istioAPIEnabled ? this.renderIstioConfigStatus(nsInfo) : 'N/A'}
                </div>

                {this.state.status && (
                  <NamespaceStatuses key={ns} name={ns} status={this.state.status} type={healthType} />
                )}

                {isControlPlane && (
                  <>
                    {this.state.controlPlanes && (
                      <div>
                        {targetPanelHR}
                        <ControlPlaneDonut controlPlanes={this.state.controlPlanes} />
                      </div>
                    )}

                    {this.state.controlPlanes && (
                      <div style={{ textAlign: 'left', alignContent: 'start', alignItems: 'start' }}>
                        {targetPanelHR}
                        <Title headingLevel="h3">Control Planes</Title>
                        <List isPlain isBordered>
                          {this.state.controlPlanes
                            .sort((a, b) => a.istiodName.localeCompare(b.istiodName))
                            .map(cp => (
                              <ListItem key={cp.istiodName}>
                                <Title headingLevel="h4">{cp.istiodName}</Title>
                                <List style={listItemStyle} isPlain>
                                  <ListItem style={listItemStyle}>
                                    Version: {cp.version ? cp.version.version : 'Unknown'}
                                  </ListItem>
                                  <ListItem style={listItemStyle}>Revision: {cp.revision}</ListItem>
                                  {cp.tag && <ListItem style={listItemStyle}>Tag: {cp.tag.name}</ListItem>}
                                </List>
                              </ListItem>
                            ))}
                        </List>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {isControlPlane && isRemoteCluster(nsInfo.annotations) && (
              <>
                {this.renderLabels(nsInfo)}

                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'inline-block', width: '125px' }}>Istio config</div>

                  {nsInfo.tlsStatus && (
                    <span>
                      <NamespaceMTLSStatus status={nsInfo.tlsStatus.status} />
                    </span>
                  )}

                  {this.props.istioAPIEnabled ? this.renderIstioConfigStatus(nsInfo) : 'N/A'}
                </div>

                {this.renderStatus()}

                <div style={{ height: '110px' }} />
              </>
            )}

            {!isControlPlane && (
              <>
                {this.renderLabels(nsInfo)}

                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'inline-block', width: '125px' }}>Istio config</div>

                  {nsInfo.tlsStatus && (
                    <span>
                      <NamespaceMTLSStatus status={nsInfo.tlsStatus.status} />
                    </span>
                  )}
                  {this.props.istioAPIEnabled ? this.renderIstioConfigStatus(nsInfo) : 'N/A'}
                </div>

                {this.renderStatus()}

                {targetPanelHR}
                {this.renderCharts()}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  private getLoading = (): React.ReactNode => {
    return (
      <div className={classes(panelStyle, targetPanelStyle)}>
        <Card isCompact={true} className={cardGridStyle}>
          <CardHeader className={panelHeadingStyle}>
            <Title headingLevel="h5" size={TitleSizes.lg}>
              <span className={namespaceNameStyle}>
                <span>Loading...</span>
              </span>
            </Title>
          </CardHeader>
        </Card>
      </div>
    );
  };

  // Find the controlplanes nodes and pull out the controlplane
  // object from infraData. The controlplane object has all the
  // managed namespaces that is needed by elements on this page.
  private getControlPlanes = (): ControlPlane[] | undefined => {
    const controlPlanes: ControlPlane[] | undefined = this.props.target.elem
      ?.getGraph()
      .getData()
      .meshData.elements.nodes?.filter(node => node.data.infraType === MeshInfraType.ISTIOD)
      .map(node => node.data.infraData);
    return controlPlanes;
  };

  private getNamespaceActions = (): OverviewNamespaceAction[] => {
    // Today actions are fixed, but soon actions may depend of the state of a namespace
    // So we keep this wrapped in a showActions function.
    const namespaceActions: OverviewNamespaceAction[] = isParentKiosk(this.props.kiosk)
      ? [
          {
            isGroup: true,
            isSeparator: false,
            isDisabled: false,
            title: 'Show',
            children: [
              {
                isGroup: true,
                isSeparator: false,
                title: 'Graph',
                action: (ns: string) =>
                  kioskOverviewAction(Show.GRAPH, ns, this.props.duration, this.props.refreshInterval)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Istio Config',
                action: (ns: string) =>
                  kioskOverviewAction(Show.ISTIO_CONFIG, ns, this.props.duration, this.props.refreshInterval)
              }
            ]
          }
        ]
      : [
          {
            isGroup: true,
            isSeparator: false,
            isDisabled: false,
            title: 'Show',
            children: [
              {
                isGroup: true,
                isSeparator: false,
                title: 'Graph',
                action: (ns: string) => this.show(Show.GRAPH, ns, healthType)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Applications',
                action: (ns: string) => this.show(Show.APPLICATIONS, ns, healthType)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Workloads',
                action: (ns: string) => this.show(Show.WORKLOADS, ns, healthType)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Services',
                action: (ns: string) => this.show(Show.SERVICES, ns, healthType)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Istio Config',
                action: (ns: string) => this.show(Show.ISTIO_CONFIG, ns, healthType)
              }
            ]
          }
        ];
    return namespaceActions;
  };

  private renderNamespaceBadges(ns: NamespaceInfo, tooltip: boolean): React.ReactNode {
    const isControlPlane = this.isControlPlane();
    return (
      <>
        {isControlPlane && ns.name !== serverConfig.istioNamespace && (
          <ControlPlaneVersionBadge version={ns.labels ? ns.labels['istio.io/rev'] : ''} />
        )}

        {isControlPlane && !this.props.istioAPIEnabled && (
          <Label style={{ marginLeft: '0.5rem' }} color="orange" isCompact>
            Istio API disabled
          </Label>
        )}

        {!isControlPlane && serverConfig.ambientEnabled && ns.labels && ns.isAmbient && (
          <AmbientBadge tooltip={tooltip ? 'labeled as part of Ambient Mesh' : undefined}></AmbientBadge>
        )}
      </>
    );
  }

  private renderLabels(ns: NamespaceInfo): React.ReactNode {
    const labelsLength = ns.labels ? `${Object.entries(ns.labels).length}` : 'No';

    const labelContent = ns.labels ? (
      <div style={{ color: PFColors.Link, textAlign: 'left', cursor: 'pointer' }}>
        <Tooltip
          aria-label="Labels list"
          position={TooltipPosition.right}
          enableFlip={true}
          distance={5}
          content={
            <ul>
              {Object.entries(ns.labels ?? []).map(([key, value]) => (
                <li key={key}>
                  {key}={value}
                </li>
              ))}
            </ul>
          }
        >
          <div id="labels_info" style={{ display: 'inline' }}>
            {labelsLength} label{labelsLength !== '1' ? 's' : ''}
          </div>
        </Tooltip>
      </div>
    ) : (
      <div style={{ textAlign: 'left' }}>No labels</div>
    );

    return labelContent;
  }

  private renderIstioConfigStatus(ns: NamespaceInfo): React.ReactNode {
    let validations: ValidationStatus = { errors: 0, namespace: ns.name, objectCount: 0, warnings: 0 };

    if (!!ns.validations) {
      validations = ns.validations;
    }

    return (
      <ValidationSummaryLink
        namespace={validations.namespace}
        objectCount={validations.objectCount}
        errors={validations.errors}
        warnings={validations.warnings}
      >
        <ValidationSummary
          id={`ns-val-${validations.namespace}`}
          errors={validations.errors}
          warnings={validations.warnings}
          objectCount={validations.objectCount}
          type="istio"
        />
      </ValidationSummaryLink>
    );
  }

  private load = (): void => {
    this.promises.cancelAll();

    this.promises
      .registerAll(`promises`, [this.fetchNamespaceInfo(), this.fetchHealthStatus(), this.fetchMetrics()])
      .then(() => {
        this.setState({ controlPlanes: this.getControlPlanes(), loading: false });
      })
      .catch(err => {
        if (err.isCanceled) {
          console.debug('TargetPanelNamespace: Ignore fetch error (canceled).');
          return;
        }

        this.setState({ ...defaultState, loading: false });
        this.handleApiError('Could not loading target namespace panel', err);
      });

    this.setState({ loading: true });
  };

  private fetchNamespaceInfo = async (): Promise<void> => {
    return API.getNamespaceInfo(this.state.targetNamespace)
      .then(response => {
        this.setState({
          nsInfo: response.data
        });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching namespace info.', error, 'default', MessageType.ERROR);
      });
  };

  private fetchHealthStatus = async (): Promise<void> => {
    const cluster = this.state.targetCluster!;
    const namespace = this.state.targetNamespace!;
    return API.getClustersAppHealth(namespace, this.props.duration, cluster!)
      .then(results => {
        const nsStatus: NamespaceStatus = {
          inNotReady: [],
          inError: [],
          inWarning: [],
          inSuccess: [],
          notAvailable: []
        };

        const rs = results[namespace];
        Object.keys(rs).forEach(item => {
          const health: Health = rs[item];
          const status = health.getGlobalStatus();

          if (status === FAILURE) {
            nsStatus.inError.push(item);
          } else if (status === DEGRADED) {
            nsStatus.inWarning.push(item);
          } else if (status === HEALTHY) {
            nsStatus.inSuccess.push(item);
          } else if (status === NOT_READY) {
            nsStatus.inNotReady.push(item);
          } else {
            nsStatus.notAvailable.push(item);
          }
        });
        this.setState({ status: nsStatus });
      })
      .catch(err => this.handleApiError('Could not fetch namespace health', err));
  };

  private fetchMetrics = async (): Promise<void> => {
    const rateParams = computePrometheusRateParams(this.props.duration, 10);
    const options: IstioMetricsOptions = {
      direction: direction,
      duration: this.props.duration,
      filters: ['request_count', 'request_error_count'],
      includeAmbient: serverConfig.ambientEnabled,
      rateInterval: rateParams.rateInterval,
      reporter: direction === 'inbound' ? 'destination' : 'source',
      step: rateParams.step
    };

    const cluster = this.state.targetCluster!;
    const namespace = this.state.targetNamespace!;

    return API.getNamespaceMetrics(namespace, options, cluster)
      .then(rs => {
        const metrics: Metric[] = rs.data.request_count as Metric[];
        const errorMetrics: Metric[] = rs.data.request_error_count as Metric[];

        this.setState({
          errorMetrics: errorMetrics,
          metrics: metrics
        });
      })
      .catch(err => this.handleApiError('Could not fetch namespace metrics', err));
  };

  private isControlPlane = (): boolean => {
    const namespace = this.state.targetNamespace!;
    return namespace === serverConfig.istioNamespace;
  };

  private handleApiError = (message: string, error: ApiError): void => {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  };

  private renderCharts(): React.ReactNode {
    if (this.state.status) {
      const namespace = this.state.targetNamespace!;

      return (
        <OverviewCardDataPlaneNamespace
          key={namespace}
          duration={this.props.duration}
          direction={direction}
          metrics={this.state.metrics}
          errorMetrics={this.state.errorMetrics}
        />
      );
    }

    return <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>Namespace metrics are not available</div>;
  }

  private renderStatus = (): React.ReactNode => {
    const targetPage = switchType(healthType, Paths.APPLICATIONS, Paths.SERVICES, Paths.WORKLOADS);
    const namespace = this.state.targetNamespace!;
    const status = this.state.status;
    let nbItems = 0;

    if (status) {
      nbItems =
        status.inError.length +
        status.inWarning.length +
        status.inSuccess.length +
        status.notAvailable.length +
        status.inNotReady.length;
    }

    let text: string;

    if (nbItems === 1) {
      text = switchType(healthType, '1 application', '1 service', '1 workload');
    } else {
      text = `${nbItems}${switchType(healthType, ' applications', ' services', ' workloads')}`;
    }

    const mainLink = (
      <div
        style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}
        data-test={`overview-type-${healthType}`}
      >
        {text}
      </div>
    );

    if (nbItems === status?.notAvailable.length) {
      return (
        <div style={{ textAlign: 'left' }}>
          <span>
            {mainLink}

            <div style={{ display: 'inline-block' }}>N/A</div>
          </span>
        </div>
      );
    }

    return (
      <div style={{ textAlign: 'left' }}>
        <span>
          {mainLink}

          <div style={{ display: 'inline-block' }} data-test="overview-app-health">
            {status && status.inNotReady.length > 0 && (
              <OverviewStatus
                id={`${namespace}-not-ready`}
                namespace={namespace}
                status={NOT_READY}
                items={status.inNotReady}
                targetPage={targetPage}
              />
            )}

            {status && status.inError.length > 0 && (
              <OverviewStatus
                id={`${namespace}-failure`}
                namespace={namespace}
                status={FAILURE}
                items={status.inError}
                targetPage={targetPage}
              />
            )}

            {status && status.inWarning.length > 0 && (
              <OverviewStatus
                id={`${namespace}-degraded`}
                namespace={namespace}
                status={DEGRADED}
                items={status.inWarning}
                targetPage={targetPage}
              />
            )}

            {status && status.inSuccess.length > 0 && (
              <OverviewStatus
                id={`${namespace}-healthy`}
                namespace={namespace}
                status={HEALTHY}
                items={status.inSuccess}
                targetPage={targetPage}
              />
            )}
          </div>
        </span>
      </div>
    );
  };

  private show = (showType: Show, namespace: string, graphType: string): void => {
    let destination = '';

    switch (showType) {
      case Show.GRAPH:
        destination = `/graph/namespaces?namespaces=${namespace}&graphType=${graphType}`;
        break;
      case Show.APPLICATIONS:
        destination = `/${Paths.APPLICATIONS}?namespaces=${namespace}`;
        break;
      case Show.WORKLOADS:
        destination = `/${Paths.WORKLOADS}?namespaces=${namespace}`;
        break;
      case Show.SERVICES:
        destination = `/${Paths.SERVICES}?namespaces=${namespace}`;
        break;
      case Show.ISTIO_CONFIG:
        destination = `/${Paths.ISTIO}?namespaces=${namespace}`;
        break;
      default:
      // Nothing to do on default case
    }

    router.navigate(destination);
  };
}
