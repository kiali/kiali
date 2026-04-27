import * as React from 'react';
import { connect, DispatchProp } from 'react-redux';
import { Tab, Title, TitleSizes, TooltipPosition } from '@patternfly/react-core';
import { KialiAppState } from 'store/Store';
import { durationSelector, meshWideMTLSStatusSelector, refreshIntervalSelector } from 'store/Selectors';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import { NamespaceInfo } from 'types/NamespaceInfo';
import { PromisesRegistry } from 'utils/CancelablePromises';
import * as API from 'services/Api';
import { addError } from 'utils/AlertUtils';
import { ParameterizedTabs, activeTab } from 'components/Tab/Tabs';
import { RenderHeader } from 'components/Nav/Page/RenderHeader';
import { ErrorSection } from 'components/ErrorSection/ErrorSection';
import { ErrorMsg } from 'types/ErrorMsg';
import { connectRefresh } from 'components/Refresh/connectRefresh';
import { HistoryManager } from 'app/History';
import { basicTabStyle } from 'styles/TabStyles';
import { setAIContext } from 'helpers/ChatAI';
import { Namespace } from 'types/Namespace';
import { MTLSStatuses, TLSStatus } from 'types/TLSStatus';
import { ValidationStatus } from 'types/IstioObjects';
import { IstioConfigList } from 'types/IstioConfigList';
import { fetchClusterNamespacesHealth } from 'services/NamespaceHealth';
import { NamespaceDetailsOverview } from './NamespaceDetailsOverview';
import { NamespaceActions } from 'pages/Namespaces/NamespaceActions';
import { Paths } from 'config';
import { router } from 'app/History';
import { Show } from 'types/Common';
import { isParentKiosk, kioskNavigateAction, kioskOverviewAction as kioskAction } from 'components/Kiosk/KioskActions';
import { healthComputeDurationValidSeconds } from 'utils/HealthComputeDuration';
import { buildNamespaceRowActions } from 'pages/Namespaces/namespaceRowActions';
import { NamespaceTrafficPolicies } from 'pages/Namespaces/NamespaceTrafficPolicies';
import { ControlPlane } from 'types/Mesh';
import { GrafanaInfo, ISTIO_DASHBOARDS } from 'types/GrafanaInfo';
import { ExternalLink } from 'types/Dashboards';
import { PersesInfo } from 'types/PersesInfo';
import { MessageType } from 'types/NotificationCenter';
import { setControlPlaneRevisions } from 'pages/Namespaces/NamespaceRevisionUtils';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { NamespaceHealthStatus } from 'pages/Namespaces/NamespaceHealthStatus';
import { TimeControl } from 'components/Time/TimeControl';
import { NA } from 'types/Health';
import { kialiStyle } from 'styles/StyleUtils';
import { isMultiCluster } from 'config';
import { RefreshIntervalManual } from 'config/Config';

const titleRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 'var(--pf-t--global--spacer--md)',
  marginTop: '0.5rem',
  minWidth: 0,
  width: '100%'
});

const titleMainStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flex: '1 1 auto',
  flexWrap: 'nowrap',
  gap: 'var(--pf-t--global--spacer--md)',
  minWidth: 0
});

type ReduxProps = {
  duration: DurationInSeconds;
  externalServices: { name: string }[];
  istioAPIEnabled: boolean;
  kiosk: string;
  meshStatus: string;
  refreshInterval: IntervalInMilliseconds;
};

type NamespaceDetailsPageProps = ReduxProps &
  DispatchProp & {
    lastRefreshAt: TimeInMilliseconds;
    namespace: string;
  };

type State = {
  cluster?: string;
  clusterTarget?: string;
  controlPlanes?: ControlPlane[];
  currentTab: string;
  error?: ErrorMsg;
  grafanaLinks: ExternalLink[];
  kind: string;
  nsInfo?: NamespaceInfo;
  nsTarget: string;
  opTarget: string;
  persesLinks: ExternalLink[];
  showTrafficPoliciesModal: boolean;
};

const tabName = 'tab';
const defaultTab = 'info';

const tabIndex: { [tab: string]: number } = {
  info: 0
};

export class NamespaceDetailsPageComponent extends React.Component<NamespaceDetailsPageProps, State> {
  private promises = new PromisesRegistry();

  static grafanaInfoPromise: Promise<GrafanaInfo | undefined> | undefined;
  static persesInfoPromise: Promise<PersesInfo | undefined> | undefined;

  constructor(props: NamespaceDetailsPageProps) {
    super(props);
    this.state = {
      cluster: HistoryManager.getClusterName(),
      clusterTarget: '',
      currentTab: activeTab(tabName, defaultTab),
      grafanaLinks: [],
      kind: '',
      nsTarget: '',
      opTarget: '',
      persesLinks: [],
      showTrafficPoliciesModal: false
    };
  }

  componentDidMount(): void {
    this.fetchGrafanaInfo();
    this.fetchPersesInfo();
    this.fetchControlPlanes();
    this.load();
  }

  componentDidUpdate(prevProps: NamespaceDetailsPageProps): void {
    const cluster = HistoryManager.getClusterName() || this.state.cluster;
    const currentTab = activeTab(tabName, defaultTab);
    const mustFetch =
      cluster !== this.state.cluster ||
      prevProps.namespace !== this.props.namespace ||
      prevProps.lastRefreshAt !== this.props.lastRefreshAt ||
      this.props.duration !== prevProps.duration;

    if (mustFetch || currentTab !== this.state.currentTab) {
      if (mustFetch || currentTab === 'info') {
        this.load(cluster)
          .then(() => {
            this.setState({ currentTab: currentTab, cluster: cluster });
          })
          .catch(() => {
            /* error state set in load */
          });
      } else {
        this.setState({ currentTab: currentTab, cluster: cluster });
      }
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  private fetchGrafanaInfo = (): void => {
    if (this.props.externalServices.find(service => service.name.toLowerCase() === 'grafana')) {
      if (!NamespaceDetailsPageComponent.grafanaInfoPromise) {
        NamespaceDetailsPageComponent.grafanaInfoPromise = API.getGrafanaInfo().then(response => {
          if (response.status === 204) {
            return undefined;
          }
          return response.data;
        });
      }

      NamespaceDetailsPageComponent.grafanaInfoPromise
        .then(grafanaInfo => {
          if (grafanaInfo) {
            this.setState({
              grafanaLinks: grafanaInfo.externalLinks.filter(link => ISTIO_DASHBOARDS.indexOf(link.name) > -1)
            });
          } else {
            this.setState({ grafanaLinks: [] });
          }
        })
        .catch(err => {
          addError('Could not fetch Grafana info. Turning off links to Grafana.', err, false, MessageType.INFO);
        });
    }
  };

  private fetchPersesInfo = (): void => {
    if (this.props.externalServices.find(service => service.name.toLowerCase() === 'perses')) {
      if (!NamespaceDetailsPageComponent.persesInfoPromise) {
        NamespaceDetailsPageComponent.persesInfoPromise = API.getPersesInfo().then(response => {
          if (response.status === 204) {
            return undefined;
          }
          return response.data;
        });
      }

      NamespaceDetailsPageComponent.persesInfoPromise
        .then(persesInfo => {
          if (persesInfo) {
            this.setState({
              persesLinks: persesInfo.externalLinks.filter(link => ISTIO_DASHBOARDS.indexOf(link.name) > -1)
            });
          } else {
            this.setState({ persesLinks: [] });
          }
        })
        .catch(err => {
          addError('Could not fetch Perses info. Turning off links to Perses.', err, false, MessageType.INFO);
        });
    }
  };

  private fetchControlPlanes = (): void => {
    API.getControlPlanes()
      .then(response => {
        const controlPlanes = response.data;
        setControlPlaneRevisions(new Set(controlPlanes.map(cp => cp.revision)));
        this.setState({ controlPlanes });
      })
      .catch(err => {
        addError('Error fetching control planes.', err);
      });
  };

  private hideTrafficManagement = (): void => {
    this.setState({
      showTrafficPoliciesModal: false,
      nsTarget: '',
      clusterTarget: '',
      opTarget: '',
      kind: ''
    });
  };

  private onChangeAfterPolicy = (): void => {
    if (this.props.refreshInterval !== RefreshIntervalManual && HistoryManager.getRefresh() !== RefreshIntervalManual) {
      this.load();
    }
  };

  private resolveNamespaceTlsStatusForDisplay = (status: string): string => {
    if (status !== MTLSStatuses.UNSET && status !== MTLSStatuses.NOT_ENABLED) {
      return status;
    }

    const meshStatus = this.props.meshStatus;

    if (
      meshStatus === MTLSStatuses.ENABLED ||
      meshStatus === MTLSStatuses.ENABLED_DEFAULT ||
      meshStatus === MTLSStatuses.AUTO_DEFAULT
    ) {
      return MTLSStatuses.UNSET_INHERITED_STRICT;
    }

    if (meshStatus === MTLSStatuses.PARTIALLY || meshStatus === MTLSStatuses.PARTIALLY_DEFAULT) {
      return MTLSStatuses.UNSET_INHERITED_PERMISSIVE;
    }

    if (meshStatus === MTLSStatuses.DISABLED) {
      return MTLSStatuses.UNSET_INHERITED_DISABLED;
    }

    return MTLSStatuses.UNSET_INHERITED_PERMISSIVE;
  };

  private namespaceToInfo = (ns: Namespace, cluster?: string): NamespaceInfo => ({
    annotations: ns.annotations,
    cluster: ns.cluster ?? cluster,
    isAmbient: ns.isAmbient,
    isControlPlane: ns.isControlPlane,
    labels: ns.labels,
    name: ns.name,
    revision: ns.revision
  });

  private buildIstioConfigForNamespace = (istioConfig: IstioConfigList, targetNamespace: string): IstioConfigList => {
    const filtered: IstioConfigList = {
      permissions: istioConfig.permissions || {},
      resources: {},
      validations: istioConfig.validations || {}
    };

    Object.entries(istioConfig.resources || {}).forEach(([key, list]) => {
      if (!Array.isArray(list)) {
        return;
      }
      const inNs = list.filter(o => o.metadata?.namespace === targetNamespace);
      if (inNs.length > 0) {
        filtered.resources[key] = inNs;
      }
    });

    return filtered;
  };

  private enrichNamespaceInfo = async (nsInfo: NamespaceInfo, cluster?: string): Promise<void> => {
    const name = nsInfo.name;

    const [healthMap, tlsResponse, validationResponse, istioAllResponse] = await Promise.all([
      fetchClusterNamespacesHealth([name], cluster, this.props.duration).catch(() => new Map()),
      API.getClustersTls(name, cluster).catch(() => ({ data: [] as TLSStatus[] })),
      API.getConfigValidations(name, cluster).catch(() => ({ data: [] as ValidationStatus[] })),
      API.getAllIstioConfigs([], false, '', '', cluster).catch(() => ({
        data: { permissions: {}, resources: {}, validations: {} } as IstioConfigList
      }))
    ]);

    const nsHealth = healthMap.get(name);
    if (nsHealth) {
      nsInfo.statusApp = nsHealth.statusApp;
      nsInfo.statusService = nsHealth.statusService;
      nsInfo.statusWorkload = nsHealth.statusWorkload;
      nsInfo.worstStatus = nsHealth.worstStatus;
    }

    tlsResponse.data.forEach(tls => {
      if (tls.namespace === name && (!cluster || tls.cluster === cluster || !tls.cluster)) {
        nsInfo.tlsStatus = {
          status: this.resolveNamespaceTlsStatusForDisplay(tls.status),
          autoMTLSEnabled: tls.autoMTLSEnabled,
          minTLS: tls.minTLS
        };
      }
    });

    validationResponse.data.forEach(v => {
      if (v.namespace === name && (!cluster || !v.cluster || v.cluster === cluster)) {
        nsInfo.validations = v;
      }
    });

    nsInfo.istioConfig = this.buildIstioConfigForNamespace(istioAllResponse.data, name);
  };

  private load = async (cluster?: string): Promise<void> => {
    if (!cluster) {
      cluster = this.state.cluster;
    }

    this.promises.cancelAll();

    return this.promises
      .register(
        'namespaceDetail',
        API.getNamespaceInfo(this.props.namespace, cluster).then(async infoResp => {
          const base = this.namespaceToInfo(infoResp.data, cluster);
          const effectiveCluster = base.cluster ?? cluster;

          await this.enrichNamespaceInfo(base, effectiveCluster);

          this.setState(
            {
              nsInfo: base,
              error: undefined,
              cluster: effectiveCluster
            },
            () => {
              setAIContext(
                this.props.dispatch,
                `Namespace Details of ${this.props.namespace}${effectiveCluster ? ` (${effectiveCluster})` : ''}`
              );
            }
          );
        })
      )
      .catch(error => {
        addError('Could not fetch Namespace.', error);
        this.setState({
          error: {
            title: 'Namespace not found',
            description: `${this.props.namespace} is not available or could not be loaded`
          },
          nsInfo: undefined
        });
        return Promise.reject(error);
      });
  };

  private kioskNamespacesAction = (showType: Show, ns: string, refreshInterval: IntervalInMilliseconds): void => {
    const duration = healthComputeDurationValidSeconds();
    if (showType === Show.GRAPH || showType === Show.ISTIO_CONFIG) {
      kioskAction(showType as never, ns, duration, refreshInterval);
      return;
    }
    let showInParent = '';
    switch (showType) {
      case Show.APPLICATIONS:
        showInParent = `/${Paths.APPLICATIONS}?namespaces=${ns}`;
        break;
      case Show.WORKLOADS:
        showInParent = `/${Paths.WORKLOADS}?namespaces=${ns}`;
        break;
      case Show.SERVICES:
        showInParent = `/${Paths.SERVICES}?namespaces=${ns}`;
        break;
      default:
        return;
    }
    showInParent += `&duration=${String(duration)}&refresh=${String(refreshInterval)}`;
    kioskNavigateAction(showInParent);
  };

  private show = (showType: Show, ns: string): void => {
    if (isParentKiosk(this.props.kiosk)) {
      this.kioskNamespacesAction(showType, ns, this.props.refreshInterval);
      return;
    }

    let destination = '';
    switch (showType) {
      case Show.GRAPH:
        destination = `/graph/namespaces?namespaces=${ns}`;
        break;
      case Show.APPLICATIONS:
        destination = `/${Paths.APPLICATIONS}?namespaces=${ns}`;
        break;
      case Show.WORKLOADS:
        destination = `/${Paths.WORKLOADS}?namespaces=${ns}`;
        break;
      case Show.SERVICES:
        destination = `/${Paths.SERVICES}?namespaces=${ns}`;
        break;
      case Show.ISTIO_CONFIG:
        destination = `/${Paths.ISTIO}?namespaces=${ns}`;
        break;
      default:
        break;
    }
    if (destination) {
      router.navigate(destination);
    }
  };

  private getNamespaceActions = (): ReturnType<typeof buildNamespaceRowActions> => {
    if (!this.state.nsInfo) {
      return [];
    }
    return buildNamespaceRowActions({
      controlPlanes: this.state.controlPlanes,
      grafanaLinks: this.state.grafanaLinks,
      istioAPIEnabled: this.props.istioAPIEnabled,
      kiosk: this.props.kiosk,
      nsInfo: this.state.nsInfo,
      onKioskShow: this.kioskNamespacesAction,
      onOpenTrafficPoliciesModal: p =>
        this.setState({
          showTrafficPoliciesModal: true,
          nsTarget: p.nsTarget,
          clusterTarget: p.clusterTarget ?? '',
          opTarget: p.opTarget,
          kind: p.kind
        }),
      onRefreshAfterExternalLink: this.onChangeAfterPolicy,
      onShow: this.show,
      persesLinks: this.state.persesLinks,
      refreshInterval: this.props.refreshInterval
    });
  };

  render(): React.ReactNode {
    const ns = this.state.nsInfo;
    const worstStatus = ns?.worstStatus ?? NA.id;
    const healthListDuration = healthComputeDurationValidSeconds();

    const actionsToolbar =
      !this.state.error && ns ? (
        <NamespaceActions
          namespace={this.props.namespace}
          actions={this.getNamespaceActions()}
          toggleVariant="actionsText"
        />
      ) : undefined;

    return (
      <div>
        <RenderHeader
          actionsToolbar={actionsToolbar}
          actionsToolbarTop="11.1rem"
          rightToolbar={<TimeControl customDuration={false} />}
        >
          {!this.state.error && ns && (
            <div className={titleRowStyle} data-test="namespace-detail-title-row">
              <div className={titleMainStyle}>
                <PFBadge badge={PFBadges.Namespace} position={TooltipPosition.top} />
                <Title headingLevel="h1" size={TitleSizes.xl} style={{ margin: 0, flexShrink: 0 }}>
                  {this.props.namespace}
                </Title>
                {ns.cluster && isMultiCluster && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                    <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.top} />
                    <span style={{ marginLeft: '0.25rem' }}>{ns.cluster}</span>
                  </span>
                )}
                <span style={{ minWidth: 0 }}>
                  <NamespaceHealthStatus
                    inlineIssueCount
                    name={this.props.namespace}
                    statusApp={ns.statusApp}
                    statusService={ns.statusService}
                    statusWorkload={ns.statusWorkload}
                    worstStatus={worstStatus}
                  />
                </span>
              </div>
            </div>
          )}
        </RenderHeader>

        {this.state.error && <ErrorSection error={this.state.error} />}

        {!this.state.error && ns && (
          <ParameterizedTabs
            id="basic-tabs"
            className={basicTabStyle}
            onSelect={tabValue => {
              this.setState({ currentTab: tabValue });
            }}
            tabMap={tabIndex}
            tabName={tabName}
            defaultTab={defaultTab}
            activeTab={this.state.currentTab}
            mountOnEnter={true}
            unmountOnExit={true}
          >
            <Tab eventKey={0} title="Overview" key="Overview">
              <NamespaceDetailsOverview duration={this.props.duration} namespace={this.props.namespace} nsInfo={ns} />
            </Tab>
          </ParameterizedTabs>
        )}

        {this.state.nsInfo && (
          <NamespaceTrafficPolicies
            opTarget={this.state.opTarget}
            isOpen={this.state.showTrafficPoliciesModal}
            controlPlanes={this.state.controlPlanes?.filter(cp =>
              cp.managedNamespaces?.some(mn => mn.name === this.state.nsTarget)
            )}
            kind={this.state.kind}
            hideConfirmModal={this.hideTrafficManagement}
            nsTarget={this.state.nsTarget}
            nsInfo={this.state.nsInfo}
            duration={healthListDuration}
            load={this.onChangeAfterPolicy}
          />
        )}
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  externalServices: state.statusState.externalServices,
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  kiosk: state.globalState.kiosk,
  meshStatus: meshWideMTLSStatusSelector(state),
  refreshInterval: refreshIntervalSelector(state)
});

export const NamespaceDetailsPage = connectRefresh(connect(mapStateToProps)(NamespaceDetailsPageComponent));
