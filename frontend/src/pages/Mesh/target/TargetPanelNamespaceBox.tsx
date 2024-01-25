import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { TargetPanelCommonProps, getTitle, targetPanelStyle, targetPanelWidth } from './TargetPanelCommon';
import { targetPanelHeadingStyle } from './TargetPanelStyle';
import { NodeAttr } from 'types/Graph';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { Card, CardHeader } from '@patternfly/react-core';
import { serverConfig } from 'config';
import { CanaryUpgradeStatus } from 'types/IstioObjects';
import { OverviewNamespaceActions } from 'pages/Overview/OverviewNamespaceActions';

type TargetPanelNamespaceBoxProps = TargetPanelCommonProps & {
  cluster: string;
};

type TargetPanelNamespaceBoxState = {
  canaryUpgradeStatus?: CanaryUpgradeStatus;
  loading: boolean;
  namespaceBox: any;
};

const defaultState: TargetPanelNamespaceBoxState = {
  loading: false,
  namespaceBox: null
};
/*
const namespaceStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});
*/

const cardControlPlaneGridStyle = kialiStyle({
  textAlign: 'center',
  marginTop: 0,
  marginBottom: '0.5rem'
});

const cardGridStyle = kialiStyle({
  textAlign: 'center',
  marginTop: 0,
  marginBottom: '0.5rem'
});

const namespaceHeaderStyle = kialiStyle({
  $nest: {
    '& .pf-v5-c-card__header-main': {
      width: '85%'
    }
  }
});

const namespaceNameStyle = kialiStyle({
  display: 'block',
  textAlign: 'left',
  overflow: 'hidden',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis'
});

export class TargetPanelNamespaceBox extends React.Component<
  TargetPanelNamespaceBoxProps,
  TargetPanelNamespaceBoxState
> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: targetPanelWidth,
    overflowY: 'auto' as 'auto',
    width: targetPanelWidth
  };

  constructor(props: TargetPanelNamespaceBoxProps) {
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

  /*
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
  */

  private renderNamespace = (ns: string): React.ReactNode => {
    const actions = this.getNamespaceActions(ns);
    const namespaceActions = (
      <OverviewNamespaceActions key={`namespaceAction_${ns}`} namespace={ns} actions={actions} />
    );

    return (
      <Card
        isCompact={true}
        className={ns === serverConfig.istioNamespace ? cardControlPlaneGridStyle : cardGridStyle}
        data-test={`${ns}-mesh-target`}
        style={!this.props.istioAPIEnabled && !this.hasCanaryUpgradeConfigured() ? { height: '96%' } : {}}
      >
        <CardHeader
          className={namespaceHeaderStyle}
          actions={{ actions: <>{namespaceActions[i]}</>, hasNoOffset: false, className: undefined }}
        >
          {
            <Title headingLevel="h5" size={TitleSizes.lg}>
              <span className={namespaceNameStyle}>
                <Tooltip
                  content={
                    <>
                      <span>{ns.name}</span>
                      {this.renderNamespaceBadges(ns, false)}
                    </>
                  }
                  position={TooltipPosition.top}
                >
                  <span>{ns.name}</span>
                </Tooltip>
                {this.renderNamespaceBadges(ns, true)}
              </span>
            </Title>
          }
        </CardHeader>
        <CardBody>
          {isMultiCluster && ns.cluster && (
            <div style={{ textAlign: 'left', paddingBottom: 3 }}>
              <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} />
              {ns.cluster}
            </div>
          )}

          {ns.name === serverConfig.istioNamespace &&
            !isRemoteCluster(ns.annotations) &&
            this.state.displayMode === OverviewDisplayMode.EXPAND && (
              <Grid>
                <GridItem md={this.props.istioAPIEnabled || this.hasCanaryUpgradeConfigured() ? 3 : 6}>
                  {this.renderLabels(ns)}

                  <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'inline-block', width: '125px' }}>Istio config</div>

                    {ns.tlsStatus && (
                      <span>
                        <NamespaceMTLSStatus status={ns.tlsStatus.status} />
                      </span>
                    )}

                    {this.props.istioAPIEnabled ? this.renderIstioConfigStatus(ns) : 'N/A'}
                  </div>

                  {ns.status && (
                    <NamespaceStatuses key={ns.name} name={ns.name} status={ns.status} type={this.state.type} />
                  )}

                  {this.state.displayMode === OverviewDisplayMode.EXPAND && (
                    <ControlPlaneNamespaceStatus
                      outboundTrafficPolicy={this.state.outboundPolicyMode}
                      namespace={ns}
                    ></ControlPlaneNamespaceStatus>
                  )}

                  {this.state.displayMode === OverviewDisplayMode.EXPAND && (
                    <TLSInfo
                      certificatesInformationIndicators={
                        serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled
                      }
                      version={this.props.minTLS}
                    ></TLSInfo>
                  )}
                </GridItem>

                {ns.name === serverConfig.istioNamespace && (
                  <GridItem md={9}>
                    <Grid>
                      {this.state.canaryUpgradeStatus && this.hasCanaryUpgradeConfigured() && (
                        <GridItem md={this.props.istioAPIEnabled ? 4 : 9}>
                          <CanaryUpgradeProgress canaryUpgradeStatus={this.state.canaryUpgradeStatus} />
                        </GridItem>
                      )}

                      {this.props.istioAPIEnabled === true && (
                        <GridItem md={this.hasCanaryUpgradeConfigured() ? 8 : 12}>{this.renderCharts(ns)}</GridItem>
                      )}
                    </Grid>
                  </GridItem>
                )}
              </Grid>
            )}

          {ns.name === serverConfig.istioNamespace &&
            isRemoteCluster(ns.annotations) &&
            this.state.displayMode === OverviewDisplayMode.EXPAND && (
              <div>
                {this.renderLabels(ns)}

                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'inline-block', width: '125px' }}>Istio config</div>

                  {ns.tlsStatus && (
                    <span>
                      <NamespaceMTLSStatus status={ns.tlsStatus.status} />
                    </span>
                  )}

                  {this.props.istioAPIEnabled ? this.renderIstioConfigStatus(ns) : 'N/A'}
                </div>

                {this.renderStatus(ns)}

                {this.state.displayMode === OverviewDisplayMode.EXPAND && (
                  <TLSInfo
                    certificatesInformationIndicators={
                      serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled
                    }
                    version={this.props.minTLS}
                  ></TLSInfo>
                )}

                {this.state.displayMode === OverviewDisplayMode.EXPAND && <div style={{ height: '110px' }} />}
              </div>
            )}

          {((ns.name !== serverConfig.istioNamespace && this.state.displayMode === OverviewDisplayMode.EXPAND) ||
            this.state.displayMode === OverviewDisplayMode.COMPACT) && (
            <div>
              {this.renderLabels(ns)}

              <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'inline-block', width: '125px' }}>Istio config</div>

                {ns.tlsStatus && (
                  <span>
                    <NamespaceMTLSStatus status={ns.tlsStatus.status} />
                  </span>
                )}
                {this.props.istioAPIEnabled ? this.renderIstioConfigStatus(ns) : 'N/A'}
              </div>

              {this.renderStatus(ns)}

              {this.state.displayMode === OverviewDisplayMode.EXPAND && this.renderCharts(ns)}
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

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
                action: (ns: string) => this.show(Show.GRAPH, ns, this.state.type)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Applications',
                action: (ns: string) => this.show(Show.APPLICATIONS, ns, this.state.type)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Workloads',
                action: (ns: string) => this.show(Show.WORKLOADS, ns, this.state.type)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Services',
                action: (ns: string) => this.show(Show.SERVICES, ns, this.state.type)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Istio Config',
                action: (ns: string) => this.show(Show.ISTIO_CONFIG, ns, this.state.type)
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
          action: (ns: string) =>
            this.setState({
              showTrafficPoliciesModal: true,
              nsTarget: ns,
              opTarget: 'enable',
              kind: 'injection',
              clusterTarget: nsInfo.cluster
            })
        };

        const disableAction = {
          'data-test': `disable-${nsInfo.name}-namespace-sidecar-injection`,
          isGroup: false,
          isSeparator: false,
          title: 'Disable Auto Injection',
          action: (ns: string) =>
            this.setState({
              showTrafficPoliciesModal: true,
              nsTarget: ns,
              opTarget: 'disable',
              kind: 'injection',
              clusterTarget: nsInfo.cluster
            })
        };

        const removeAction = {
          'data-test': `remove-${nsInfo.name}-namespace-sidecar-injection`,
          isGroup: false,
          isSeparator: false,
          title: 'Remove Auto Injection',
          action: (ns: string) =>
            this.setState({
              showTrafficPoliciesModal: true,
              nsTarget: ns,
              opTarget: 'remove',
              kind: 'injection',
              clusterTarget: nsInfo.cluster
            })
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
          action: (ns: string) =>
            this.setState({
              opTarget: 'upgrade',
              kind: 'canary',
              nsTarget: ns,
              showTrafficPoliciesModal: true,
              clusterTarget: nsInfo.cluster
            })
        };

        const downgradeAction = {
          isGroup: false,
          isSeparator: false,
          title: `Downgrade to ${serverConfig.istioCanaryRevision.current} revision`,
          action: (ns: string) =>
            this.setState({
              opTarget: 'current',
              kind: 'canary',
              nsTarget: ns,
              showTrafficPoliciesModal: true,
              clusterTarget: nsInfo.cluster
            })
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
        action: (ns: string) => {
          this.setState({
            opTarget: aps.length === 0 ? 'create' : 'update',
            nsTarget: ns,
            clusterTarget: nsInfo.cluster,
            showTrafficPoliciesModal: true,
            kind: 'policy'
          });
        }
      };

      const removeAuthorizationAction = {
        isGroup: false,
        isSeparator: false,
        title: 'Delete Traffic Policies',
        action: (ns: string) =>
          this.setState({
            opTarget: 'delete',
            nsTarget: ns,
            showTrafficPoliciesModal: true,
            kind: 'policy',
            clusterTarget: nsInfo.cluster
          })
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
    } else if (this.state.grafanaLinks.length > 0) {
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
    }

    return namespaceActions;
  };
}
