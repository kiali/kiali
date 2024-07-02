import * as React from 'react';
import { ElementModel, GraphElement, Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { TargetPanelCommonProps, shouldRefreshData, targetPanelHR, targetPanelStyle } from './TargetPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { Card, CardBody, CardHeader, Label, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Paths, serverConfig } from 'config';
import { CanaryUpgradeStatus, ValidationStatus } from 'types/IstioObjects';
import { OverviewNamespaceAction, OverviewNamespaceActions } from 'pages/Overview/OverviewNamespaceActions';
import { NamespaceInfo, NamespaceStatus } from 'types/NamespaceInfo';
import { isRemoteCluster } from 'pages/Overview/OverviewCardControlPlaneNamespace';
import { NamespaceMTLSStatus } from 'components/MTls/NamespaceMTLSStatus';
import { NamespaceStatuses } from 'pages/Overview/NamespaceStatuses';
import { DirectionType, OverviewType } from 'pages/Overview/OverviewToolbar';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { CanaryUpgradeProgress } from 'pages/Overview/CanaryUpgradeProgress';
import { isParentKiosk, kioskOverviewAction } from 'components/Kiosk/KioskActions';
import { Show } from 'pages/Overview/OverviewPage';
import { ControlPlaneBadge } from 'pages/Overview/ControlPlaneBadge';
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
import { history } from '../../../app/History';
import * as AlertUtils from '../../../utils/AlertUtils';
import { MessageType } from 'types/MessageCenter';
import { OverviewStatus } from 'pages/Overview/OverviewStatus';
import { switchType } from 'pages/Overview/OverviewHelper';
import { TLSStatus } from 'types/TLSStatus';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import { Metric } from 'types/Metrics';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';

type TargetPanelNamespaceProps = TargetPanelCommonProps;

type TargetPanelNamespaceState = {
  canaryUpgradeStatus?: CanaryUpgradeStatus;
  errorMetrics?: Metric[];
  loading: boolean;
  metrics?: Metric[];
  nsInfo?: NamespaceInfo;
  status?: NamespaceStatus;
  targetCluster?: string;
  targetNamespace?: string;
  targetNode?: Node<NodeModel, any>;
  tlsStatus?: TLSStatus;
};

const defaultState: TargetPanelNamespaceState = {
  canaryUpgradeStatus: undefined,
  errorMetrics: undefined,
  loading: false,
  nsInfo: undefined,
  status: undefined,
  targetNode: undefined,
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

    const targetNode = this.props.target.elem as Node<NodeModel, any>;
    const data = (props.target.elem as GraphElement<ElementModel, any>).getData();
    this.state = {
      ...defaultState,
      targetCluster: data.cluster,
      targetNamespace: data.namespace,
      targetNode: targetNode
    };
  }

  static getDerivedStateFromProps(
    props: TargetPanelCommonProps,
    state: TargetPanelNamespaceState
  ): TargetPanelNamespaceState | null {
    // if the target (e.g. namespaceBox) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.targetNode
      ? ({
          targetNode: props.target.elem,
          targetCluster: (props.target.elem as GraphElement<ElementModel, any>).getData().cluster,
          targetNamespace: (props.target.elem as GraphElement<ElementModel, any>).getData().namespace,
          loading: true
        } as TargetPanelNamespaceState)
      : null;
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
    if (this.state.loading || !this.state.nsInfo) {
      return this.getLoading();
    }

    const isControlPlane = this.isControlPlane();
    const nsInfo = this.state.nsInfo;
    const ns = nsInfo.name;
    const actions = this.getNamespaceActions(nsInfo);
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
                    {this.state.canaryUpgradeStatus && this.hasCanaryUpgradeConfigured() && (
                      <>
                        {targetPanelHR}
                        <CanaryUpgradeProgress canaryUpgradeStatus={this.state.canaryUpgradeStatus} />
                      </>
                    )}

                    {this.props.istioAPIEnabled && (
                      <>
                        {targetPanelHR}
                        {this.renderCharts()}
                      </>
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

  private hasCanaryUpgradeConfigured = (): boolean => {
    if (this.state.canaryUpgradeStatus) {
      if (
        this.state.canaryUpgradeStatus.pendingNamespaces.length > 0 ||
        this.state.canaryUpgradeStatus.migratedNamespaces.length > 0
      ) {
        return true;
      }
    }

    return false;
  };

  private getNamespaceActions = (nsInfo: NamespaceInfo): OverviewNamespaceAction[] => {
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
    // We are going to assume that if the user can create/update Istio AuthorizationPolicies in a namespace
    // then it can use the Istio Injection Actions.
    // RBAC allow more fine granularity but Kiali won't check that in detail.

    if (serverConfig.istioNamespace !== nsInfo.name) {
      if (serverConfig.kialiFeatureFlags.istioInjectionAction && !serverConfig.kialiFeatureFlags.istioUpgradeAction) {
        namespaceActions.push({
          isGroup: false,
          isSeparator: true
        });

        const enableAction = {
          'data-test': `enable-${nsInfo.name}-namespace-sidecar-injection`,
          isGroup: false,
          isSeparator: false,
          title: 'Enable Auto Injection',
          action: (ns: string) => console.log(`TODO: Enable Auto Injection [${ns}]`)
          /*
            this.setState({
              showTrafficPoliciesModal: true,
              nsTarget: ns,
              opTarget: 'enable',
              kind: 'injection',
              clusterTarget: nsInfo.cluster
            })
            */
        };

        const disableAction = {
          'data-test': `disable-${nsInfo.name}-namespace-sidecar-injection`,
          isGroup: false,
          isSeparator: false,
          title: 'Disable Auto Injection',
          action: (ns: string) => console.log(`TODO: Disable Auto Injection [${ns}]`)
          /*
            this.setState({
              showTrafficPoliciesModal: true,
              nsTarget: ns,
              opTarget: 'disable',
              kind: 'injection',
              clusterTarget: nsInfo.cluster
            })
            */
        };

        const removeAction = {
          'data-test': `remove-${nsInfo.name}-namespace-sidecar-injection`,
          isGroup: false,
          isSeparator: false,
          title: 'Remove Auto Injection',
          action: (ns: string) => console.log(`TODO: Remove Auto Injection [${ns}]`)
          /*
            this.setState({
              showTrafficPoliciesModal: true,
              nsTarget: ns,
              opTarget: 'remove',
              kind: 'injection',
              clusterTarget: nsInfo.cluster
            })
            */
        };

        if (
          nsInfo.labels &&
          ((nsInfo.labels[serverConfig.istioLabels.injectionLabelName] &&
            nsInfo.labels[serverConfig.istioLabels.injectionLabelName] === 'enabled') ||
            nsInfo.labels[serverConfig.istioLabels.injectionLabelRev])
        ) {
          namespaceActions.push(disableAction);
          namespaceActions.push(removeAction);
        } else if (
          nsInfo.labels &&
          nsInfo.labels[serverConfig.istioLabels.injectionLabelName] &&
          nsInfo.labels[serverConfig.istioLabels.injectionLabelName] === 'disabled'
        ) {
          namespaceActions.push(enableAction);
          namespaceActions.push(removeAction);
        } else {
          namespaceActions.push(enableAction);
        }
      }

      if (
        serverConfig.kialiFeatureFlags.istioUpgradeAction &&
        serverConfig.istioCanaryRevision.upgrade &&
        serverConfig.istioCanaryRevision.current
      ) {
        namespaceActions.push({
          isGroup: false,
          isSeparator: true
        });

        const upgradeAction = {
          isGroup: false,
          isSeparator: false,
          title: `Upgrade to ${serverConfig.istioCanaryRevision.upgrade} revision`,
          action: (ns: string) => console.log(`TODO: Upgrade revision [${ns}]`)
          /*
            this.setState({
              opTarget: 'upgrade',
              kind: 'canary',
              nsTarget: ns,
              showTrafficPoliciesModal: true,
              clusterTarget: nsInfo.cluster
            })
            */
        };

        const downgradeAction = {
          isGroup: false,
          isSeparator: false,
          title: `Downgrade to ${serverConfig.istioCanaryRevision.current} revision`,
          action: (ns: string) => console.log(`TODO: Downgrade revision [${ns}]`)
          /*
            this.setState({
              opTarget: 'current',
              kind: 'canary',
              nsTarget: ns,
              showTrafficPoliciesModal: true,
              clusterTarget: nsInfo.cluster
            })
            */
        };

        if (
          nsInfo.labels &&
          ((nsInfo.labels[serverConfig.istioLabels.injectionLabelRev] &&
            nsInfo.labels[serverConfig.istioLabels.injectionLabelRev] === serverConfig.istioCanaryRevision.current) ||
            (nsInfo.labels[serverConfig.istioLabels.injectionLabelName] &&
              nsInfo.labels[serverConfig.istioLabels.injectionLabelName] === 'enabled'))
        ) {
          namespaceActions.push(upgradeAction);
        } else if (
          nsInfo.labels &&
          nsInfo.labels[serverConfig.istioLabels.injectionLabelRev] &&
          nsInfo.labels[serverConfig.istioLabels.injectionLabelRev] === serverConfig.istioCanaryRevision.upgrade
        ) {
          namespaceActions.push(downgradeAction);
        }
      }

      const aps = nsInfo.istioConfig?.authorizationPolicies ?? [];

      const addAuthorizationAction = {
        isGroup: false,
        isSeparator: false,
        title: `${aps.length === 0 ? 'Create ' : 'Update'} Traffic Policies`,
        action: (ns: string) => console.log(`TODO: create traffic policies [${ns}]`)
        /*
          this.setState({
            opTarget: aps.length === 0 ? 'create' : 'update',
            nsTarget: ns,
            clusterTarget: nsInfo.cluster,
            showTrafficPoliciesModal: true,
            kind: 'policy'
          });
        */
      };

      const removeAuthorizationAction = {
        isGroup: false,
        isSeparator: false,
        title: 'Delete Traffic Policies',
        action: (ns: string) => console.log(`TODO: delete traffic policies [${ns}]`)
        /*
          this.setState({
            opTarget: 'delete',
            nsTarget: ns,
            showTrafficPoliciesModal: true,
            kind: 'policy',
            clusterTarget: nsInfo.cluster
          })
          */
      };

      if (this.props.istioAPIEnabled) {
        namespaceActions.push({
          isGroup: false,
          isSeparator: true
        });

        namespaceActions.push(addAuthorizationAction);

        if (aps.length > 0) {
          namespaceActions.push(removeAuthorizationAction);
        }
      }
    } else {
      console.log(`TODO: grafana links`);
      /*
    if (this.state.grafanaLinks.length > 0) {
      // Istio namespace will render external Grafana dashboards
      namespaceActions.push({
        isGroup: false,
        isSeparator: true
      });

      this.state.grafanaLinks.forEach(link => {
        const grafanaDashboard = {
          isGroup: false,
          isSeparator: false,
          isExternal: true,
          title: link.name,
          action: (_ns: string) => {
            window.open(link.url, '_blank');
            this.load();
          }
        };

        namespaceActions.push(grafanaDashboard);
      });
      */
    }

    return namespaceActions;
  };

  private renderNamespaceBadges(ns: NamespaceInfo, tooltip: boolean): React.ReactNode {
    const isControlPlane = this.isControlPlane();
    return (
      <>
        {isControlPlane && <ControlPlaneBadge cluster={ns.cluster} annotations={ns.annotations}></ControlPlaneBadge>}

        {!isControlPlane &&
          this.hasCanaryUpgradeConfigured() &&
          this.state.canaryUpgradeStatus?.migratedNamespaces.includes(ns.name) && (
            <ControlPlaneVersionBadge
              version={this.state.canaryUpgradeStatus.upgradeVersion}
              isCanary={true}
            ></ControlPlaneVersionBadge>
          )}

        {!isControlPlane &&
          this.hasCanaryUpgradeConfigured() &&
          this.state.canaryUpgradeStatus?.pendingNamespaces.includes(ns.name) && (
            <ControlPlaneVersionBadge
              version={this.state.canaryUpgradeStatus.currentVersion}
              isCanary={false}
            ></ControlPlaneVersionBadge>
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

    API.getNamespaces()
      .then(result => {
        const cluster = this.state.targetCluster;
        const namespace = this.state.targetNamespace;
        const nsInfo = result.data.find(ns => ns.cluster === cluster && ns.name === namespace);
        if (!nsInfo) {
          AlertUtils.add(`Failed to find |${cluster}:${namespace}| in GetNamespaces() result`);
          this.setState({ ...defaultState, loading: false });
          return;
        }

        this.promises
          .registerAll(`promises-${cluster}:${namespace}`, [
            this.fetchCanariesStatus(),
            this.fetchHealthStatus(),
            this.fetchMetrics()
          ])
          .then(_ => {
            this.setState({ loading: false, nsInfo: nsInfo });
          })
          .catch(err => {
            if (err.isCanceled) {
              console.debug('TargetPanelNamespace: Ignore fetch error (canceled).');
              return;
            }

            this.setState({ ...defaultState, loading: false });
            this.handleApiError('Could not loading target namespace panel', err);
          });
      })
      .catch(err => {
        if (err.isCanceled) {
          console.debug('TargetPanelNamespace: Ignore fetch error (canceled).');
          return;
        }

        this.setState({ ...defaultState, loading: false });
        this.handleApiError('Could not fetch namespaces when loading target panel', err);
      });

    this.setState({ loading: true });
  };

  private fetchCanariesStatus(): Promise<void> {
    if (!this.isControlPlane()) {
      return Promise.resolve();
    }

    return API.getCanaryUpgradeStatus()
      .then(response => {
        this.setState({
          canaryUpgradeStatus: {
            currentVersion: response.data.currentVersion,
            upgradeVersion: response.data.upgradeVersion,
            migratedNamespaces: response.data.migratedNamespaces,
            pendingNamespaces: response.data.pendingNamespaces
          }
        });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching namespace canary upgrade status.', error, 'default', MessageType.ERROR);
      });
  }

  private fetchHealthStatus(): Promise<void> {
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
  }

  private fetchMetrics(): Promise<void> {
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
  }

  private isControlPlane = (): boolean => {
    const namespace = this.state.targetNamespace!;
    return namespace === serverConfig.istioNamespace;
  };

  private handleApiError(message: string, error: ApiError): void {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  }

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

  private renderStatus(): React.ReactNode {
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
  }

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
    history.push(destination);
  };
}
