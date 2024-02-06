import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import {
  TargetPanelCommonProps,
  shouldRefreshData,
  targetPanel,
  targetPanelBodyStyle as targetPanelBody,
  targetPanelBorder,
  targetPanelHR,
  targetPanelWidth
} from './TargetPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { Card, CardBody, CardHeader, Label, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Paths, serverConfig } from 'config';
import { CanaryUpgradeStatus, OutboundTrafficPolicy, ValidationStatus } from 'types/IstioObjects';
import { OverviewNamespaceAction, OverviewNamespaceActions } from 'pages/Overview/OverviewNamespaceActions';
import { NamespaceInfo, NamespaceStatus } from 'types/NamespaceInfo';
import { isRemoteCluster } from 'pages/Overview/OverviewCardControlPlaneNamespace';
import { NamespaceMTLSStatus } from 'components/MTls/NamespaceMTLSStatus';
import { NamespaceStatuses } from 'pages/Overview/NamespaceStatuses';
import { DirectionType, OverviewType } from 'pages/Overview/OverviewToolbar';
import { ControlPlaneNamespaceStatus } from 'pages/Overview/ControlPlaneNamespaceStatus';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { TLSInfo } from 'components/Overview/TLSInfo';
import { CanaryUpgradeProgress } from 'pages/Overview/CanaryUpgradeProgress';
import { isParentKiosk, kioskOverviewAction } from 'components/Kiosk/KioskActions';
import { Show } from 'pages/Overview/OverviewPage';
import { DurationInSeconds } from 'types/Common';
import { ControlPlaneBadge } from 'pages/Overview/ControlPlaneBadge';
import { ControlPlaneVersionBadge } from 'pages/Overview/ControlPlaneVersionBadge';
import { AmbientBadge } from 'components/Ambient/AmbientBadge';
import { PFColors } from 'components/Pf/PfColors';
import { ValidationSummaryLink } from 'components/Link/ValidationSummaryLink';
import { ValidationSummary } from 'components/Validations/ValidationSummary';
import { OverviewCardSparklineCharts } from 'pages/Overview/OverviewCardSparklineCharts';
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
import { IstiodResourceThresholds } from 'types/IstioStatus';
import { TLSStatus, nsWideMTLSStatus } from 'types/TLSStatus';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import { NodeAttr } from 'types/Graph';
import { NodeData } from '../MeshElems';
import { ControlPlaneMetricsMap, Metric } from 'types/Metrics';
import { classes } from 'typestyle';
import { panelHeadingStyle } from 'pages/Graph/SummaryPanelStyle';

type TargetPanelNamespaceProps = TargetPanelCommonProps & {
  meshStatus: string;
  minTLS: string;
};

type TargetPanelNamespaceState = {
  canaryUpgradeStatus?: CanaryUpgradeStatus;
  controlPlaneMetrics?: ControlPlaneMetricsMap;
  errorMetrics?: Metric[];
  istiodResourceThresholds?: IstiodResourceThresholds;
  loading: boolean;
  metrics?: Metric[];
  nsInfo?: NamespaceInfo;
  namespaceNode?: Node<NodeModel, any>;
  outboundPolicyMode?: OutboundTrafficPolicy;
  status?: NamespaceStatus;
  tlsStatus?: TLSStatus;
};

const defaultState: TargetPanelNamespaceState = {
  canaryUpgradeStatus: undefined,
  controlPlaneMetrics: undefined,
  errorMetrics: undefined,
  istiodResourceThresholds: undefined,
  loading: false,
  nsInfo: undefined,
  namespaceNode: undefined,
  outboundPolicyMode: undefined,
  status: undefined,
  tlsStatus: undefined
};

// TODO: Should these remain fixed values?
const healthType: OverviewType = 'app';
const direction: DirectionType = 'outbound';
const duration: DurationInSeconds = 60;

/*
const namespaceStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});
*/

const cardGridStyle = kialiStyle({
  textAlign: 'center',
  marginTop: 0,
  marginBottom: '0.5rem'
  // width: 'auto'
});

/*
const namespaceHeaderStyle = kialiStyle({
  $nest: {
    '& .pf-v5-c-card__header-main': {
      width: '85%'
    }
  }
});
*/

const namespaceNameStyle = kialiStyle({
  display: 'block',
  textAlign: 'left',
  overflow: 'hidden',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis'
});

export class TargetPanelNamespace extends React.Component<TargetPanelNamespaceProps, TargetPanelNamespaceState> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: targetPanelWidth,
    overflowY: 'auto' as 'auto',
    width: targetPanelWidth
  };

  private cluster: string;
  private namespace: string;
  private promises = new PromisesRegistry();

  constructor(props: TargetPanelNamespaceProps) {
    super(props);

    const namespaceNode = this.props.target.elem as Node<NodeModel, any>;
    this.cluster = namespaceNode.getData()[NodeAttr.cluster];
    this.namespace = namespaceNode.getData()[NodeAttr.namespace];

    this.state = {
      ...defaultState,
      namespaceNode: namespaceNode
    };
  }

  static getDerivedStateFromProps(
    props: TargetPanelCommonProps,
    state: TargetPanelNamespaceState
  ): TargetPanelNamespaceState | null {
    // if the target (e.g. namespaceBox) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.namespaceNode
      ? ({ namespaceNode: props.target.elem, loading: true } as TargetPanelNamespaceState)
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

  shouldComponentUpdate(
    _nextProps: Readonly<TargetPanelNamespaceProps>,
    nextState: Readonly<TargetPanelNamespaceState>,
    _nextContext: any
  ): boolean {
    if (nextState.loading) {
      console.log(`Loading...: ${JSON.stringify(this.state.nsInfo)}`);
    } else {
      console.log(`Done Loading: ${JSON.stringify(this.state.nsInfo)}`);
    }
    return nextState.loading === false;
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  render() {
    if (this.state.loading || !this.state.nsInfo) {
      return null;
    }

    const isControlPlane = this.isControlPlane();
    const nsInfo = this.state.nsInfo!;
    const ns = nsInfo.name;
    const actions = this.getNamespaceActions(nsInfo);
    const namespaceActions = (
      <OverviewNamespaceActions key={`namespaceAction_${ns}`} namespace={ns} actions={actions} />
    );

    return (
      <div className={classes(targetPanelBorder, targetPanel)}>
        <Card
          isCompact={true}
          className={cardGridStyle}
          data-test={`${ns}-mesh-target`}
          style={!this.props.istioAPIEnabled && !this.hasCanaryUpgradeConfigured() ? { height: '96%' } : {}}
        >
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
          <CardBody>
            {isControlPlane && !isRemoteCluster(nsInfo.annotations) && (
              <div className={targetPanelBody}>
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

                {this.state.status && (
                  <NamespaceStatuses key={ns} name={ns} status={this.state.status} type={healthType} />
                )}

                <ControlPlaneNamespaceStatus
                  outboundTrafficPolicy={this.state.outboundPolicyMode}
                  namespace={nsInfo}
                ></ControlPlaneNamespaceStatus>

                <TLSInfo
                  certificatesInformationIndicators={
                    serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled
                  }
                  version={this.props.minTLS}
                ></TLSInfo>

                {isControlPlane && (
                  <div>
                    {targetPanelHR()}
                    {this.state.canaryUpgradeStatus && this.hasCanaryUpgradeConfigured() && (
                      <div>
                        {targetPanelHR}
                        <CanaryUpgradeProgress canaryUpgradeStatus={this.state.canaryUpgradeStatus} />
                      </div>
                    )}
                    <div>{this.props.istioAPIEnabled && <div>{this.renderCharts()}</div>}</div>
                  </div>
                )}
              </div>
            )}

            {isControlPlane && isRemoteCluster(nsInfo.annotations) && (
              <div className={targetPanelBody}>
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

                <TLSInfo
                  certificatesInformationIndicators={
                    serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled
                  }
                  version={this.props.minTLS}
                ></TLSInfo>

                <div style={{ height: '110px' }} />
              </div>
            )}

            {!isControlPlane && (
              <div className={targetPanelBody}>
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

                {targetPanelHR()}
                {this.renderCharts()}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  hasCanaryUpgradeConfigured = (): boolean => {
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

  getNamespaceActions = (nsInfo: NamespaceInfo): OverviewNamespaceAction[] => {
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
                action: (ns: string) => kioskOverviewAction(Show.GRAPH, ns, duration, this.props.refreshInterval)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Istio Config',
                action: (ns: string) => kioskOverviewAction(Show.ISTIO_CONFIG, ns, duration, this.props.refreshInterval)
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

  renderNamespaceBadges(ns: NamespaceInfo, tooltip: boolean): JSX.Element {
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

  renderLabels(ns: NamespaceInfo): JSX.Element {
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

  renderIstioConfigStatus(ns: NamespaceInfo): JSX.Element {
    let validations: ValidationStatus = { objectCount: 0, errors: 0, warnings: 0 };

    if (!!ns.validations) {
      validations = ns.validations;
    }

    return (
      <ValidationSummaryLink
        namespace={ns.name}
        objectCount={validations.objectCount}
        errors={validations.errors}
        warnings={validations.warnings}
      >
        <ValidationSummary
          id={`ns-val-${ns.name}`}
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
        const data = this.state.namespaceNode!.getData() as NodeData;
        const cluster = data.cluster;
        const namespace = data.namespace;
        const nsInfo = result.data.find(ns => ns.cluster === cluster && ns.name === namespace);
        if (!nsInfo) {
          AlertUtils.add(`Failed to find |${cluster}:${namespace}| in GetNamespaces() result`);
          this.setState({ ...defaultState, loading: false });
          return;
        }
        this.setState({ nsInfo: nsInfo });

        this.promises
          .registerAll(`promises-${this.cluster}:${this.namespace}`, [
            this.fetchCanariesStatus(),
            this.fetchHealthStatus(),
            this.fetchIstiodResourceThresholds(),
            this.fetchMetrics(),
            this.fetchOutboundTrafficPolicyMode(),
            this.fetchTLS()
          ])
          .then(_ => {
            this.setState({ loading: false });
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
    return API.getNamespaceAppHealth(this.namespace, duration, this.cluster)
      .then(rs => {
        console.log('In HealthStatus');
        const nsStatus: NamespaceStatus = {
          inNotReady: [],
          inError: [],
          inWarning: [],
          inSuccess: [],
          notAvailable: []
        };

        console.log(`rs=${JSON.stringify(rs)}`);

        Object.keys(rs).forEach(item => {
          console.log(`In Key ${item}`);
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
          console.log(`Out Key ${item}`);
        });
        console.log('In SetState');
        this.setState({ status: nsStatus });
        console.log('Out HealthStatus');
      })
      .catch(err => this.handleApiError('Could not fetch namespace health', err));
  }

  private fetchIstiodResourceThresholds(): Promise<void> {
    if (!this.isControlPlane()) {
      return Promise.resolve();
    }

    return API.getIstiodResourceThresholds()
      .then(response => {
        this.setState({ istiodResourceThresholds: response.data });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching Istiod resource thresholds.', error, 'default', MessageType.ERROR);
      });
  }

  private fetchMetrics(): Promise<void> {
    const rateParams = computePrometheusRateParams(duration, 10);
    const options: IstioMetricsOptions = {
      filters: ['request_count', 'request_error_count'],
      duration: duration,
      step: rateParams.step,
      rateInterval: rateParams.rateInterval,
      direction: direction,
      reporter: direction === 'inbound' ? 'destination' : 'source'
    };

    return API.getNamespaceMetrics(this.namespace, options, this.cluster)
      .then(rs => {
        const metrics: Metric[] = rs.data.request_count as Metric[];
        const errorMetrics: Metric[] = rs.data.request_error_count as Metric[];

        if (this.isControlPlane()) {
          const controlPlaneMetrics: ControlPlaneMetricsMap = {
            istiod_proxy_time: rs.data.pilot_proxy_convergence_time,
            istiod_container_cpu: rs.data.container_cpu_usage_seconds_total,
            istiod_container_mem: rs.data.container_memory_working_set_bytes,
            istiod_process_cpu: rs.data.process_cpu_seconds_total,
            istiod_process_mem: rs.data.process_resident_memory_bytes
          };
          this.setState({
            controlPlaneMetrics: controlPlaneMetrics,
            errorMetrics: errorMetrics,
            metrics: metrics
          });
        } else {
          this.setState({
            errorMetrics: errorMetrics,
            metrics: metrics
          });
        }
      })
      .catch(err => this.handleApiError('Could not fetch namespace metrics', err));
  }

  private fetchTLS(): Promise<void> {
    if (!this.isControlPlane()) {
      return Promise.resolve();
    }

    return API.getNamespaceTls(this.namespace, this.cluster)
      .then(rs => {
        this.setState({
          tlsStatus: {
            status: nsWideMTLSStatus(rs.data.status, this.props.meshStatus),
            autoMTLSEnabled: rs.data.autoMTLSEnabled,
            minTLS: rs.data.minTLS
          }
        });
      })
      .catch(err => this.handleApiError('Could not fetch namespace TLS status', err));
  }

  private fetchOutboundTrafficPolicyMode(): Promise<void> {
    if (!this.isControlPlane()) {
      return Promise.resolve();
    }

    return API.getOutboundTrafficPolicyMode()
      .then(response => {
        this.setState({ outboundPolicyMode: { mode: response.data.mode } });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching Mesh OutboundTrafficPolicy.Mode.', error, 'default', MessageType.ERROR);
      });
  }

  private isControlPlane = () => {
    return this.namespace === serverConfig.istioNamespace;
  };

  private handleApiError(message: string, error: ApiError): void {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  }

  private renderCharts(): JSX.Element {
    if (this.state.status) {
      return (
        <OverviewCardSparklineCharts
          key={this.namespace}
          name={this.namespace}
          annotations={this.state.nsInfo!.annotations}
          duration={duration}
          direction={direction}
          metrics={this.state.metrics}
          errorMetrics={this.state.errorMetrics}
          controlPlaneMetrics={this.state.controlPlaneMetrics}
          istiodResourceThresholds={this.state.istiodResourceThresholds}
        />
      );
    }

    return <div style={{ height: '70px' }} />;
  }

  private renderStatus(): JSX.Element {
    const targetPage = switchType(healthType, Paths.APPLICATIONS, Paths.SERVICES, Paths.WORKLOADS);
    const name = this.namespace;
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
                id={`${name}-not-ready`}
                namespace={name}
                status={NOT_READY}
                items={status.inNotReady}
                targetPage={targetPage}
              />
            )}

            {status && status.inError.length > 0 && (
              <OverviewStatus
                id={`${name}-failure`}
                namespace={name}
                status={FAILURE}
                items={status.inError}
                targetPage={targetPage}
              />
            )}

            {status && status.inWarning.length > 0 && (
              <OverviewStatus
                id={`${name}-degraded`}
                namespace={name}
                status={DEGRADED}
                items={status.inWarning}
                targetPage={targetPage}
              />
            )}

            {status && status.inSuccess.length > 0 && (
              <OverviewStatus
                id={`${name}-healthy`}
                namespace={name}
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
