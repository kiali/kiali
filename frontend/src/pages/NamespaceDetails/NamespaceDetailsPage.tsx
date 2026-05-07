import * as React from 'react';
import { connect, DispatchProp } from 'react-redux';
import { Tab, Title, TitleSizes, TooltipPosition } from '@patternfly/react-core';
import { KialiAppState } from 'store/Store';
import { durationSelector, meshWideMTLSStatusSelector, refreshIntervalSelector } from 'store/Selectors';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import { NamespaceInfo } from 'types/NamespaceInfo';
import { PromisesRegistry } from 'utils/CancelablePromises';
import * as API from 'services/Api';
import { addError, addSuccess } from 'utils/AlertUtils';
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
import { healthComputeDurationValidSeconds } from 'utils/HealthComputeDuration';
import { buildNamespaceRowActions } from './namespaceDetailActions';
import { NamespaceTrafficPolicies } from 'pages/Namespaces/NamespaceTrafficPolicies';
import { ControlPlane } from 'types/Mesh';
import { GrafanaInfo, ISTIO_DASHBOARDS } from 'types/GrafanaInfo';
import { ExternalLink } from 'types/Dashboards';
import { PersesInfo } from 'types/PersesInfo';
import { MessageType } from 'types/NotificationCenter';
import { setControlPlaneRevisions } from 'pages/Namespaces/NamespaceRevisionUtils';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { TimeControl } from 'components/Time/TimeControl';
import { kialiStyle } from 'styles/StyleUtils';
import { RefreshIntervalManual } from 'config/Config';
import { serverConfig } from 'config/ServerConfig';
import { t } from 'utils/I18nUtils';

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
  gap: 'var(--pf-t--global--spacer--sm)',
  minWidth: 0
});

type ReduxProps = {
  duration: DurationInSeconds;
  externalServices: { name: string }[];
  istioAPIEnabled: boolean;
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
  private _isMounted = false;

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
    this._isMounted = true;
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
    this._isMounted = false;
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
          if (!this._isMounted) {
            return;
          }
          if (grafanaInfo) {
            this.setState({
              grafanaLinks: grafanaInfo.externalLinks.filter(link => ISTIO_DASHBOARDS.indexOf(link.name) > -1)
            });
          } else {
            this.setState({ grafanaLinks: [] });
          }
        })
        .catch(err => {
          addError(t('Could not fetch Grafana info. Turning off links to Grafana.'), err, false, MessageType.INFO);
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
          if (!this._isMounted) {
            return;
          }
          if (persesInfo) {
            this.setState({
              persesLinks: persesInfo.externalLinks.filter(link => ISTIO_DASHBOARDS.indexOf(link.name) > -1)
            });
          } else {
            this.setState({ persesLinks: [] });
          }
        })
        .catch(err => {
          addError(t('Could not fetch Perses info. Turning off links to Perses.'), err, false, MessageType.INFO);
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
        addError(t('Error fetching control planes.'), err);
      });
  };

  private handleHideTrafficManagement = (): void => {
    this.setState({
      showTrafficPoliciesModal: false,
      nsTarget: '',
      clusterTarget: '',
      opTarget: '',
      kind: ''
    });
  };

  private handleChangeAfterPolicy = (): void => {
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
      API.getIstioConfig(name, [], false, '', '', cluster).catch(() => ({
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
        addError(t('Could not fetch Namespace.'), error);
        this.setState({
          error: {
            title: t('Namespace not found'),
            description: t('{{namespace}} is not available or could not be loaded', { namespace: this.props.namespace })
          },
          nsInfo: undefined
        });
        return Promise.reject(error);
      });
  };

  private getNamespaceActions = (): ReturnType<typeof buildNamespaceRowActions> => {
    if (!this.state.nsInfo) {
      return [];
    }
    return buildNamespaceRowActions({
      controlPlanes: this.state.controlPlanes,
      grafanaLinks: this.state.grafanaLinks,
      istioAPIEnabled: this.props.istioAPIEnabled,
      nsInfo: this.state.nsInfo,
      onOpenTrafficPoliciesModal: p =>
        this.setState({
          showTrafficPoliciesModal: true,
          nsTarget: p.nsTarget,
          clusterTarget: p.clusterTarget ?? '',
          opTarget: p.opTarget,
          kind: p.kind
        }),
      onRefreshAfterExternalLink: this.handleChangeAfterPolicy,
      persesLinks: this.state.persesLinks
    });
  };

  private handleSaveMetadata = (field: 'labels' | 'annotations', updated: Record<string, string>): void => {
    const original = (field === 'labels' ? this.state.nsInfo?.labels : this.state.nsInfo?.annotations) ?? {};
    const patch: Record<string, string | null> = { ...updated };
    Object.keys(original).forEach(key => {
      if (!(key in updated)) {
        patch[key] = null;
      }
    });
    const jsonPatch = JSON.stringify({ metadata: { [field]: patch } });

    API.updateNamespace(this.props.namespace, jsonPatch, this.state.cluster)
      .then(() => {
        addSuccess(t('Namespace {{namespace}} {{field}} updated', { namespace: this.props.namespace, field }));
        this.load();
      })
      .catch(error => {
        addError(
          t('Could not update namespace {{namespace}} {{field}}', { namespace: this.props.namespace, field }),
          error
        );
      });
  };

  private handleSaveLabels = (labels: Record<string, string>): void => {
    this.handleSaveMetadata('labels', labels);
  };

  private handleSaveAnnotations = (annotations: Record<string, string>): void => {
    this.handleSaveMetadata('annotations', annotations);
  };

  render(): React.ReactNode {
    const ns = this.state.nsInfo;
    const healthListDuration = healthComputeDurationValidSeconds();

    const namespaceActions = !this.state.error && ns ? this.getNamespaceActions() : [];
    const hasActions = namespaceActions.some(a => !a.isSeparator);

    const actionsToolbar = hasActions ? (
      <NamespaceActions namespace={this.props.namespace} actions={namespaceActions} toggleVariant="actionsText" />
    ) : undefined;

    return (
      <>
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
            <Tab eventKey={0} title={t('Overview')} key="Overview">
              <NamespaceDetailsOverview
                canEdit={!serverConfig.deployment.viewOnlyMode}
                duration={this.props.duration}
                namespace={this.props.namespace}
                namespaceActions={namespaceActions}
                nsInfo={ns}
                onSaveAnnotations={this.handleSaveAnnotations}
                onSaveLabels={this.handleSaveLabels}
              />
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
            hideConfirmModal={this.handleHideTrafficManagement}
            nsTarget={this.state.nsTarget}
            nsInfo={this.state.nsInfo}
            duration={healthListDuration}
            load={this.handleChangeAfterPolicy}
          />
        )}
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  externalServices: state.statusState.externalServices,
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  meshStatus: meshWideMTLSStatusSelector(state),
  refreshInterval: refreshIntervalSelector(state)
});

export const NamespaceDetailsPage = connectRefresh(connect(mapStateToProps)(NamespaceDetailsPageComponent));
