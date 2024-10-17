import * as React from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Grid,
  GridItem,
  Label,
  Title,
  TitleSizes,
  Tooltip,
  TooltipPosition,
  EmptyStateHeader
} from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { FilterSelected, StatefulFiltersRef } from '../../components/Filters/StatefulFilters';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import * as API from '../../services/Api';
import {
  DEGRADED,
  FAILURE,
  HEALTHY,
  NOT_READY,
  NamespaceServiceHealth,
  NamespaceWorkloadHealth,
  Health,
  NamespaceAppHealth
} from '../../types/Health';
import { ControlPlane } from '../../types/Mesh';
import { SortField } from '../../types/SortFilters';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { OverviewToolbar, OverviewDisplayMode, OverviewType, DirectionType } from './OverviewToolbar';
import { NamespaceInfo, NamespaceStatus } from '../../types/NamespaceInfo';
import { NamespaceMTLSStatus } from '../../components/MTls/NamespaceMTLSStatus';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { OverviewCardDataPlaneNamespace } from './OverviewCardDataPlaneNamespace';
import { OverviewTrafficPolicies } from './OverviewTrafficPolicies';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { computePrometheusRateParams } from '../../services/Prometheus';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import {
  durationSelector,
  languageSelector,
  meshWideMTLSStatusSelector,
  minTLSVersionSelector,
  refreshIntervalSelector
} from '../../store/Selectors';
import { nsWideMTLSStatus, TLSStatus } from '../../types/TLSStatus';
import { switchType } from './OverviewHelper';
import * as Sorts from './Sorts';
import * as Filters from './Filters';
import { ValidationSummary } from '../../components/Validations/ValidationSummary';
import { DurationInSeconds, IntervalInMilliseconds } from 'types/Common';
import { Paths, isMultiCluster, serverConfig } from '../../config';
import { PFColors } from '../../components/Pf/PfColors';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { OverviewNamespaceAction, OverviewNamespaceActions } from './OverviewNamespaceActions';
import { router, HistoryManager, URLParam } from '../../app/History';
import * as AlertUtils from '../../utils/AlertUtils';
import { MessageType } from '../../types/MessageCenter';
import { ValidationStatus } from '../../types/IstioObjects';
import { GrafanaInfo, ISTIO_DASHBOARDS } from '../../types/GrafanaInfo';
import { ExternalLink } from '../../types/Dashboards';
import { isParentKiosk, kioskOverviewAction } from '../../components/Kiosk/KioskActions';
import { ValidationSummaryLink } from '../../components/Link/ValidationSummaryLink';
import { ControlPlaneBadge } from './ControlPlaneBadge';
import { OverviewStatus } from './OverviewStatus';
import { ControlPlaneVersionBadge } from './ControlPlaneVersionBadge';
import { AmbientBadge } from '../../components/Ambient/AmbientBadge';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { ApiError } from 'types/Api';
import { dicIstioTypeToGVK, IstioConfigList } from 'types/IstioConfigList';
import { t } from 'utils/I18nUtils';
import { gvkToString } from '../../utils/IstioConfigUtils';

const gridStyleCompact = kialiStyle({
  backgroundColor: PFColors.BackgroundColor200,
  paddingBottom: '1.25rem',
  marginTop: 0,
  flex: '1'
});

const gridStyleList = kialiStyle({
  backgroundColor: PFColors.BackgroundColor200,
  // The VirtualTable component has a different style than cards
  // We need to adjust the grid style if we are on compact vs list view
  padding: '0 !important',
  marginTop: 0,
  flex: '1'
});

const cardGridStyle = kialiStyle({
  textAlign: 'center',
  marginTop: 0,
  marginBottom: '0.5rem'
});

const emptyStateStyle = kialiStyle({
  height: '300px',
  marginRight: '0.25rem',
  marginBottom: '0.5rem',
  marginTop: '0.5rem'
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

export enum Show {
  GRAPH,
  APPLICATIONS,
  WORKLOADS,
  SERVICES,
  ISTIO_CONFIG
}

type State = {
  clusterTarget?: string;
  controlPlanes?: ControlPlane[];
  direction: DirectionType;
  displayMode: OverviewDisplayMode;
  grafanaLinks: ExternalLink[];
  kind: string;
  namespaces: NamespaceInfo[];
  nsTarget: string;
  opTarget: string;
  showTrafficPoliciesModal: boolean;
  type: OverviewType;
};

type ReduxProps = {
  duration: DurationInSeconds;
  istioAPIEnabled: boolean;
  kiosk: string;
  language: string;
  meshStatus: string;
  minTLS: string;
  navCollapse: boolean;
  refreshInterval: IntervalInMilliseconds;
};

type OverviewProps = ReduxProps;

export class OverviewPageComponent extends React.Component<OverviewProps, State> {
  private sFOverviewToolbar: StatefulFiltersRef = React.createRef();
  private promises = new PromisesRegistry();

  // Grafana promise is only invoked by componentDidMount() no need to repeat it on componentDidUpdate()
  static grafanaInfoPromise: Promise<GrafanaInfo | undefined> | undefined;

  constructor(props: OverviewProps) {
    super(props);
    const display = HistoryManager.getParam(URLParam.DISPLAY_MODE);

    this.state = {
      namespaces: [],
      type: OverviewToolbar.currentOverviewType(),
      direction: OverviewToolbar.currentDirectionType(),
      displayMode: display ? Number(display) : OverviewDisplayMode.EXPAND,
      showTrafficPoliciesModal: false,
      kind: '',
      nsTarget: '',
      clusterTarget: '',
      opTarget: '',
      grafanaLinks: [],
      controlPlanes: undefined
    };
  }

  componentDidUpdate(prevProps: OverviewProps): void {
    if (prevProps.duration !== this.props.duration || prevProps.navCollapse !== this.props.navCollapse) {
      // Reload to avoid graphical glitches with charts
      // TODO: this workaround should probably be deleted after switch to Patternfly 4, see https://issues.jboss.org/browse/KIALI-3116
      this.load();
    }
  }

  componentDidMount(): void {
    this.fetchGrafanaInfo();
    this.load();
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  sortFields = (): SortField<NamespaceInfo>[] => {
    return Sorts.sortFields;
  };

  getStartDisplayMode = (isCompact: boolean): number => {
    // Check if there is a displayMode option
    const historyDisplayMode = HistoryManager.getParam(URLParam.DISPLAY_MODE);

    if (historyDisplayMode) {
      return Number(historyDisplayMode);
    }

    // In this case is the first time that we are loading Overview Page, calculate the best view
    return isCompact ? OverviewDisplayMode.COMPACT : OverviewDisplayMode.EXPAND;
  };

  load = (): void => {
    this.promises.cancelAll();

    this.promises
      .register('namespaces', API.getNamespaces())
      .then(namespacesResponse => {
        const nameFilters = FilterSelected.getSelected().filters.filter(
          f => f.category === Filters.nameFilter.category
        );

        const allNamespaces: NamespaceInfo[] = namespacesResponse.data
          .filter(ns => {
            return nameFilters.length === 0 || nameFilters.some(f => ns.name.includes(f.value));
          })
          .map(ns => {
            const previous = this.state.namespaces.find(prev => prev.name === ns.name && prev.cluster === ns.cluster);

            return {
              name: ns.name,
              cluster: ns.cluster,
              isAmbient: ns.isAmbient,
              status: previous ? previous.status : undefined,
              tlsStatus: previous ? previous.tlsStatus : undefined,
              metrics: previous ? previous.metrics : undefined,
              errorMetrics: previous ? previous.errorMetrics : undefined,
              validations: previous ? previous.validations : undefined,
              labels: ns.labels,
              annotations: ns.annotations,
              revision: ns.revision
            };
          });

        const isAscending = FilterHelper.isCurrentSortAscending();
        const sortField = FilterHelper.currentSortField(Sorts.sortFields);
        const type = OverviewToolbar.currentOverviewType();
        const direction = OverviewToolbar.currentDirectionType();
        const displayMode = this.getStartDisplayMode(allNamespaces.length > 16);

        // Set state before actually fetching health
        this.setState(
          prevState => {
            return {
              type: type,
              direction: direction,
              namespaces: Sorts.sortFunc(allNamespaces, sortField, isAscending),
              displayMode: displayMode,
              showTrafficPoliciesModal: prevState.showTrafficPoliciesModal,
              kind: prevState.kind,
              nsTarget: prevState.nsTarget,
              opTarget: prevState.opTarget
            };
          },
          () => {
            this.fetchHealth(isAscending, sortField, type);
            this.fetchTLS(isAscending, sortField);
            this.fetchValidations(isAscending, sortField);
            this.fetchControlPlanes();

            if (displayMode !== OverviewDisplayMode.COMPACT) {
              this.fetchMetrics(direction);
            }
          }
        );
      })
      .catch(namespacesError => {
        if (!namespacesError.isCanceled) {
          this.handleApiError('Could not fetch namespace list', namespacesError);
        }
      });
  };

  fetchHealth = (isAscending: boolean, sortField: SortField<NamespaceInfo>, type: OverviewType): void => {
    const duration = FilterHelper.currentDuration();
    const uniqueClusters = new Set<string>();

    this.state.namespaces.forEach(namespace => {
      if (namespace.cluster) {
        uniqueClusters.add(namespace.cluster);
      }
    });

    uniqueClusters.forEach(cluster => {
      this.promises
        .registerChained('health', undefined, () =>
          this.fetchHealthForCluster(this.state.namespaces, cluster, duration, type)
        )
        .then(() => {
          this.setState(prevState => {
            let newNamespaces = prevState.namespaces.slice();

            if (sortField.id === 'health') {
              newNamespaces = Sorts.sortFunc(newNamespaces, sortField, isAscending);
            }

            return { namespaces: newNamespaces };
          });
        });
    });
  };

  fetchHealthForCluster = async (
    namespaces: NamespaceInfo[],
    cluster: string,
    duration: DurationInSeconds,
    type: OverviewType
  ): Promise<void> => {
    const apiFunc = switchType(
      type,
      API.getClustersAppHealth,
      API.getClustersServiceHealth,
      API.getClustersWorkloadHealth
    );

    const healthPromise: Promise<
      Map<string, NamespaceAppHealth> | Map<string, NamespaceWorkloadHealth> | Map<string, NamespaceServiceHealth>
    > = apiFunc(
      namespaces
        .filter(ns => ns.cluster === cluster)
        .map(ns => ns.name)
        .join(','),
      duration,
      cluster
    );

    return healthPromise
      .then(results => {
        namespaces.forEach(nsInfo => {
          const nsStatus: NamespaceStatus = {
            inNotReady: [],
            inError: [],
            inWarning: [],
            inSuccess: [],
            notAvailable: []
          };

          if (((nsInfo.cluster && nsInfo.cluster === cluster) || !nsInfo.cluster) && results[nsInfo.name]) {
            Object.keys(results[nsInfo.name]).forEach(k => {
              const health: Health = results[nsInfo.name][k];
              const status = health.getGlobalStatus();

              if (status === FAILURE) {
                nsStatus.inError.push(k);
              } else if (status === DEGRADED) {
                nsStatus.inWarning.push(k);
              } else if (status === HEALTHY) {
                nsStatus.inSuccess.push(k);
              } else if (status === NOT_READY) {
                nsStatus.inNotReady.push(k);
              } else {
                nsStatus.notAvailable.push(k);
              }
            });
            nsInfo.status = nsStatus;
          }
        });
      })
      .catch(err => this.handleApiError('Could not fetch health', err));
  };

  fetchMetrics = (direction: DirectionType): void => {
    const duration = FilterHelper.currentDuration();
    const uniqueClusters = new Set<string>();

    this.state.namespaces.forEach(namespace => {
      if (namespace.cluster) {
        uniqueClusters.add(namespace.cluster);
      }
    });

    uniqueClusters.forEach(cluster => {
      this.promises
        .registerChained('metrics', undefined, () =>
          this.fetchMetricsForCluster(this.state.namespaces, cluster, duration, direction)
        )
        .then(() => {
          this.setState(prevState => {
            return { namespaces: prevState.namespaces.slice() };
          });
        });
    });
  };

  fetchMetricsForCluster = async (
    namespaces: NamespaceInfo[],
    cluster: string,
    duration: number,
    direction: DirectionType
  ): Promise<NamespaceInfo[] | void> => {
    const rateParams = computePrometheusRateParams(duration, 10);

    const options: IstioMetricsOptions = {
      direction: direction,
      duration: duration,
      filters: ['request_count', 'request_error_count'],
      includeAmbient: serverConfig.ambientEnabled,
      rateInterval: rateParams.rateInterval,
      reporter: direction === 'inbound' ? 'destination' : 'source',
      step: rateParams.step
    };

    return API.getClustersMetrics(
      namespaces
        .filter(ns => ns.cluster === cluster)
        .map(ns => ns.name)
        .join(','),
      options,
      cluster
    )
      .then(results => {
        namespaces.forEach(nsInfo => {
          if (((nsInfo.cluster && nsInfo.cluster === cluster) || !nsInfo.cluster) && results.data[nsInfo.name]) {
            const rs = results.data[nsInfo.name];
            nsInfo.metrics = rs.request_count;
            nsInfo.errorMetrics = rs.request_error_count;

            /*
            if (nsInfo.name === serverConfig.istioNamespace) {
              nsInfo.controlPlaneMetrics = {
                istiod_proxy_time: rs.pilot_proxy_convergence_time,
                istiod_container_cpu: rs.container_cpu_usage_seconds_total,
                istiod_container_mem: rs.container_memory_working_set_bytes,
                istiod_process_cpu: rs.process_cpu_seconds_total,
                istiod_process_mem: rs.process_resident_memory_bytes
              };
            }
            */
          }
        });
      })
      .catch(err => this.handleApiError('Could not fetch metrics', err));
  };

  fetchTLS = (isAscending: boolean, sortField: SortField<NamespaceInfo>): void => {
    const uniqueClusters = new Set<string>();

    this.state.namespaces.forEach(namespace => {
      if (namespace.cluster) {
        uniqueClusters.add(namespace.cluster);
      }
    });

    uniqueClusters.forEach(cluster => {
      this.promises
        .registerChained('tls', undefined, () => this.fetchTLSForCluster(this.state.namespaces, cluster))
        .then(() => {
          this.setState(prevState => {
            let newNamespaces = prevState.namespaces.slice();

            if (sortField.id === 'mtls') {
              newNamespaces = Sorts.sortFunc(newNamespaces, sortField, isAscending);
            }

            return { namespaces: newNamespaces };
          });
        });
    });
  };

  fetchTLSForCluster = async (namespaces: NamespaceInfo[], cluster: string): Promise<void> => {
    API.getClustersTls(
      namespaces
        .filter(ns => ns.cluster === cluster)
        .map(ns => ns.name)
        .join(','),
      cluster
    )
      .then(results => {
        const tlsByClusterAndNamespace = new Map<string, Map<string, TLSStatus>>();
        results.data.forEach(tls => {
          if (tls.cluster && !tlsByClusterAndNamespace.has(tls.cluster)) {
            tlsByClusterAndNamespace.set(tls.cluster, new Map<string, TLSStatus>());
          }
          if (tls.cluster && tls.namespace) {
            tlsByClusterAndNamespace.get(tls.cluster)!.set(tls.namespace, tls);
          }
        });

        namespaces.forEach(nsInfo => {
          if (nsInfo.cluster && nsInfo.cluster === cluster && tlsByClusterAndNamespace.get(cluster)) {
            const tlsStatus = tlsByClusterAndNamespace.get(cluster)!.get(nsInfo.name);
            nsInfo.tlsStatus = {
              status: nsWideMTLSStatus(tlsStatus!.status, this.props.meshStatus),
              autoMTLSEnabled: tlsStatus!.autoMTLSEnabled,
              minTLS: tlsStatus!.minTLS
            };
          }
        });
      })
      .catch(err => this.handleApiError('Could not fetch TLS status', err));
  };

  fetchValidations = (isAscending: boolean, sortField: SortField<NamespaceInfo>): void => {
    const uniqueClusters = new Set<string>();

    this.state.namespaces.forEach(namespace => {
      if (namespace.cluster) {
        uniqueClusters.add(namespace.cluster);
      }
    });

    uniqueClusters.forEach(cluster => {
      this.promises
        .registerChained('validation', undefined, () =>
          this.fetchValidationResultForCluster(this.state.namespaces, cluster)
        )
        .then(() => {
          this.setState(prevState => {
            let newNamespaces = prevState.namespaces.slice();

            if (sortField.id === 'validations') {
              newNamespaces = Sorts.sortFunc(newNamespaces, sortField, isAscending);
            }

            return { namespaces: newNamespaces };
          });
        });
    });
  };

  fetchValidationResultForCluster = async (namespaces: NamespaceInfo[], cluster: string): Promise<void> => {
    return Promise.all([
      API.getConfigValidations(
        namespaces
          .filter(ns => ns.cluster === cluster)
          .map(ns => ns.name)
          .join(','),
        cluster
      ),
      API.getAllIstioConfigs([], false, '', '', cluster)
    ])
      .then(results => {
        const validations = results[0].data;
        const istioConfig = results[1].data;
        const validationsByClusterAndNamespace = new Map<string, Map<string, ValidationStatus>>();
        validations.forEach(validation => {
          if (validation.cluster && !validationsByClusterAndNamespace.has(validation.cluster)) {
            validationsByClusterAndNamespace.set(validation.cluster, new Map<string, ValidationStatus>());
          }
          if (validation.cluster && validation.namespace) {
            validationsByClusterAndNamespace.get(validation.cluster)!.set(validation.namespace, validation);
          }
        });

        const istioConfigPerNamespace = new Map<string, IstioConfigList>();
        Object.entries(istioConfig).forEach(([key, configListField]) => {
          if (Array.isArray(configListField)) {
            configListField.forEach(istioObject => {
              if (!istioConfigPerNamespace.has(istioObject.metadata.namespace)) {
                const newIstioConfigList: IstioConfigList = {
                  permissions: {},
                  resources: {},
                  validations: {}
                };
                istioConfigPerNamespace.set(istioObject.metadata.namespace, newIstioConfigList);
              }
              istioConfigPerNamespace.get(istioObject.metadata.namespace)![key].push(istioObject);
            });
          }
        });

        namespaces.forEach(nsInfo => {
          if (nsInfo.cluster && nsInfo.cluster === cluster && validationsByClusterAndNamespace.get(cluster)) {
            nsInfo.validations = validationsByClusterAndNamespace.get(cluster)!.get(nsInfo.name);
          }

          if (nsInfo.cluster && nsInfo.cluster === cluster) {
            nsInfo.istioConfig = istioConfigPerNamespace.get(nsInfo.name);
          }
        });
      })
      .catch(err => this.handleApiError('Could not fetch validations status', err));
  };

  fetchGrafanaInfo = (): void => {
    if (!OverviewPageComponent.grafanaInfoPromise) {
      OverviewPageComponent.grafanaInfoPromise = API.getGrafanaInfo().then(response => {
        if (response.status === 204) {
          return undefined;
        }

        return response.data;
      });
    }

    OverviewPageComponent.grafanaInfoPromise
      .then(grafanaInfo => {
        if (grafanaInfo) {
          // For Overview Page only Performance and Wasm Extension dashboard are interesting
          this.setState({
            grafanaLinks: grafanaInfo.externalLinks.filter(link => ISTIO_DASHBOARDS.indexOf(link.name) > -1)
          });
        } else {
          this.setState({ grafanaLinks: [] });
        }
      })
      .catch(err => {
        AlertUtils.addMessage({
          ...AlertUtils.extractApiError('Could not fetch Grafana info. Turning off links to Grafana.', err),
          group: 'default',
          type: MessageType.INFO,
          showNotification: false
        });
      });
  };

  private fetchControlPlanes = async (): Promise<void> => {
    return API.getControlPlanes()
      .then(response => {
        this.setState({
          controlPlanes: response.data
        });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching controlplanes.', error, 'default', MessageType.ERROR);
      });
  };

  handleApiError = (message: string, error: ApiError): void => {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  };

  sort = (sortField: SortField<NamespaceInfo>, isAscending: boolean): void => {
    const sorted = Sorts.sortFunc(this.state.namespaces, sortField, isAscending);
    this.setState({ namespaces: sorted });
  };

  setDisplayMode = (mode: OverviewDisplayMode): void => {
    this.setState({ displayMode: mode });
    HistoryManager.setParam(URLParam.DISPLAY_MODE, String(mode));

    if (mode === OverviewDisplayMode.EXPAND) {
      // Load metrics
      this.fetchMetrics(this.state.direction);
    }
  };

  isNamespaceEmpty = (ns: NamespaceInfo): boolean => {
    return (
      !!ns.status &&
      ns.status.inError.length +
        ns.status.inSuccess.length +
        ns.status.inWarning.length +
        ns.status.notAvailable.length ===
        0
    );
  };

  show = (showType: Show, namespace: string, graphType: string): void => {
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
      if (
        !(
          serverConfig.ambientEnabled &&
          nsInfo.labels &&
          nsInfo.labels[serverConfig.istioLabels.ambientNamespaceLabel] ===
            serverConfig.istioLabels.ambientNamespaceLabelValue
        ) &&
        serverConfig.kialiFeatureFlags.istioInjectionAction &&
        !serverConfig.kialiFeatureFlags.istioUpgradeAction
      ) {
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

      if (serverConfig.kialiFeatureFlags.istioUpgradeAction && this.hasCanaryUpgradeConfigured()) {
        const revisionActions = this.state.controlPlanes
          ?.filter(
            controlplane =>
              nsInfo.revision &&
              controlplane.managedClusters?.some(managedCluster => managedCluster.name === nsInfo.cluster) &&
              controlplane.revision !== nsInfo.revision
          )
          .map(controlPlane => ({
            isGroup: false,
            isSeparator: false,
            title: `Switch to ${controlPlane.revision} revision`,
            action: (ns: string) =>
              this.setState({
                opTarget: controlPlane.revision,
                kind: 'canary',
                nsTarget: ns,
                showTrafficPoliciesModal: true,
                clusterTarget: nsInfo.cluster
              })
          }));

        if (revisionActions && revisionActions.length > 0) {
          namespaceActions.push({
            isGroup: false,
            isSeparator: true
          });
        }

        revisionActions?.forEach(action => {
          namespaceActions.push(action);
        });
      }

      const aps = nsInfo.istioConfig?.resources[gvkToString(dicIstioTypeToGVK['AuthorizationPolicy'])] ?? [];

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

  hideTrafficManagement = (): void => {
    this.setState({
      showTrafficPoliciesModal: false,
      nsTarget: '',
      clusterTarget: '',
      opTarget: '',
      kind: ''
    });
  };

  hasCanaryUpgradeConfigured = (): boolean => {
    return this.state.controlPlanes !== undefined;
  };

  render(): React.ReactNode {
    const sm = this.state.displayMode === OverviewDisplayMode.COMPACT ? 3 : 6;
    const md = this.state.displayMode === OverviewDisplayMode.COMPACT ? 3 : 4;

    const filteredNamespaces = FilterHelper.runFilters(
      this.state.namespaces,
      Filters.availableFilters,
      FilterSelected.getSelected()
    );

    const namespaceActions = filteredNamespaces.map((ns, i) => {
      const actions = this.getNamespaceActions(ns);
      return <OverviewNamespaceActions key={`namespaceAction_${i}`} namespace={ns.name} actions={actions} />;
    });

    const hiddenColumns = isMultiCluster ? [] : ['cluster'];

    return (
      <>
        <OverviewToolbar
          onRefresh={this.load}
          onError={FilterHelper.handleError}
          sort={this.sort}
          displayMode={this.state.displayMode}
          setDisplayMode={this.setDisplayMode}
          statefulFilterRef={this.sFOverviewToolbar}
        />
        {filteredNamespaces.length > 0 ? (
          <RenderComponentScroll
            className={this.state.displayMode === OverviewDisplayMode.LIST ? gridStyleList : gridStyleCompact}
          >
            {this.state.displayMode === OverviewDisplayMode.LIST ? (
              <VirtualList
                rows={filteredNamespaces}
                sort={this.sort}
                statefulProps={this.sFOverviewToolbar}
                actions={namespaceActions}
                hiddenColumns={hiddenColumns}
                type="overview"
              />
            ) : (
              <Grid>
                {filteredNamespaces.map((ns, i) => {
                  return (
                    <GridItem
                      sm={sm}
                      md={md}
                      key={`CardItem_${ns.name}_${ns.cluster}`}
                      data-test={`CardItem_${ns.name}_${ns.cluster}`}
                      style={{ margin: '0 0.25rem' }}
                    >
                      <Card
                        isCompact={true}
                        className={cardGridStyle}
                        data-test={`${ns.name}-${OverviewDisplayMode[this.state.displayMode]}`}
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

                          {(this.state.displayMode === OverviewDisplayMode.EXPAND ||
                            this.state.displayMode === OverviewDisplayMode.COMPACT) && (
                            <>
                              {this.renderLabels(ns)}

                              <div style={{ textAlign: 'left' }}>
                                <div style={{ display: 'inline-block', width: '125px' }}>{t('Istio config')}</div>

                                {ns.tlsStatus && (
                                  <span>
                                    <NamespaceMTLSStatus status={ns.tlsStatus.status} />
                                  </span>
                                )}
                                {this.props.istioAPIEnabled ? this.renderIstioConfigStatus(ns) : 'N/A'}
                              </div>

                              {this.renderStatus(ns)}

                              {this.state.displayMode === OverviewDisplayMode.EXPAND && this.renderCharts(ns)}
                            </>
                          )}
                        </CardBody>
                      </Card>
                    </GridItem>
                  );
                })}
              </Grid>
            )}
          </RenderComponentScroll>
        ) : (
          <EmptyState className={emptyStateStyle} variant={EmptyStateVariant.full}>
            <EmptyStateHeader titleText="No unfiltered namespaces" headingLevel="h5" />
            <EmptyStateBody>
              Either all namespaces are being filtered or the user has no permission to access namespaces.
            </EmptyStateBody>
          </EmptyState>
        )}

        <OverviewTrafficPolicies
          opTarget={this.state.opTarget}
          isOpen={this.state.showTrafficPoliciesModal}
          controlPlanes={this.state.controlPlanes?.filter(cp =>
            cp.managedNamespaces?.some(mn => mn.name === this.state.nsTarget)
          )}
          kind={this.state.kind}
          hideConfirmModal={this.hideTrafficManagement}
          nsTarget={this.state.nsTarget}
          nsInfo={
            this.state.namespaces.filter(
              ns => ns.name === this.state.nsTarget && ns.cluster === this.state.clusterTarget
            )[0]
          }
          duration={this.props.duration}
          load={this.load}
        />
      </>
    );
  }

  renderLabels = (ns: NamespaceInfo): React.ReactNode => {
    let labelsInfo: string;

    if (ns.labels) {
      const labelsLength = Object.entries(ns.labels).length;
      labelsInfo = t('{{count}} label', {
        count: labelsLength,
        defaultValue_one: '{{count}} label',
        defaultValue_other: '{{count}} labels'
      });
    } else {
      labelsInfo = t('No labels');
    }

    const labelContent = ns.labels ? (
      <div
        style={{ color: PFColors.Link, textAlign: 'left', cursor: 'pointer' }}
        onClick={() => this.setDisplayMode(OverviewDisplayMode.LIST)}
      >
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
            {labelsInfo}
          </div>
        </Tooltip>
      </div>
    ) : (
      <div style={{ textAlign: 'left' }}>{labelsInfo}</div>
    );

    return labelContent;
  };

  renderCharts = (ns: NamespaceInfo): React.ReactNode => {
    return (
      <div style={{ height: '130px' }}>
        {ns.status ? (
          <OverviewCardDataPlaneNamespace
            key={ns.name}
            duration={FilterHelper.currentDuration()}
            direction={this.state.direction}
            metrics={ns.metrics}
            errorMetrics={ns.errorMetrics}
          />
        ) : (
          <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>Namespace metrics are not available</div>
        )}
      </div>
    );
  };

  renderIstioConfigStatus = (ns: NamespaceInfo): React.ReactNode => {
    let validations: ValidationStatus = { namespace: ns.name, objectCount: 0, errors: 0, warnings: 0 };

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
          id={`ns-val-${ns.name}`}
          errors={validations.errors}
          warnings={validations.warnings}
          objectCount={validations.objectCount}
          type="istio"
        />
      </ValidationSummaryLink>
    );
  };

  renderStatus = (ns: NamespaceInfo): React.ReactNode => {
    const targetPage = switchType(this.state.type, Paths.APPLICATIONS, Paths.SERVICES, Paths.WORKLOADS);
    const name = ns.name;
    let nbItems = 0;

    if (ns.status) {
      nbItems =
        ns.status.inError.length +
        ns.status.inWarning.length +
        ns.status.inSuccess.length +
        ns.status.notAvailable.length +
        ns.status.inNotReady.length;
    }

    let text: string;

    switch (targetPage) {
      case Paths.APPLICATIONS:
        text = t('{{count}} application', {
          count: nbItems,
          defaultValueOne: '{{count}} application',
          defaultValueOther: '{{count}} applications'
        });
        break;
      case Paths.SERVICES:
        text = t('{{count}} service', {
          count: nbItems,
          defaultValueOne: '{{count}} service',
          defaultValueOther: '{{count}} services'
        });
        break;
      case Paths.WORKLOADS:
        text = t('{{count}} workload', {
          count: nbItems,
          defaultValueOne: '{{count}} workload',
          defaultValueOther: '{{count}} workloads'
        });
        break;
    }

    const mainLink = (
      <div
        style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}
        data-test={`overview-type-${this.state.type}`}
      >
        {text}
      </div>
    );

    if (nbItems === ns.status?.notAvailable.length) {
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
            {ns.status && ns.status.inNotReady.length > 0 && (
              <OverviewStatus
                id={`${name}-not-ready`}
                namespace={name}
                status={NOT_READY}
                items={ns.status.inNotReady}
                targetPage={targetPage}
              />
            )}

            {ns.status && ns.status.inError.length > 0 && (
              <OverviewStatus
                id={`${name}-failure`}
                namespace={name}
                status={FAILURE}
                items={ns.status.inError}
                targetPage={targetPage}
              />
            )}

            {ns.status && ns.status.inWarning.length > 0 && (
              <OverviewStatus
                id={`${name}-degraded`}
                namespace={name}
                status={DEGRADED}
                items={ns.status.inWarning}
                targetPage={targetPage}
              />
            )}

            {ns.status && ns.status.inSuccess.length > 0 && (
              <OverviewStatus
                id={`${name}-healthy`}
                namespace={name}
                status={HEALTHY}
                items={ns.status.inSuccess}
                targetPage={targetPage}
              />
            )}
          </div>
        </span>
      </div>
    );
  };

  renderNamespaceBadges = (ns: NamespaceInfo, tooltip: boolean): React.ReactNode => {
    return (
      <>
        {ns.name === serverConfig.istioNamespace && (
          <ControlPlaneBadge cluster={ns.cluster} annotations={ns.annotations}></ControlPlaneBadge>
        )}

        {ns.name !== serverConfig.istioNamespace && ns.revision && <ControlPlaneVersionBadge version={ns.revision} />}

        {ns.name === serverConfig.istioNamespace && !this.props.istioAPIEnabled && (
          <Label style={{ marginLeft: '0.5rem' }} color="orange" isCompact>
            Istio API disabled
          </Label>
        )}

        {serverConfig.ambientEnabled && ns.name !== serverConfig.istioNamespace && ns.labels && ns.isAmbient && (
          <AmbientBadge tooltip={tooltip ? 'labeled as part of Ambient Mesh' : undefined}></AmbientBadge>
        )}
      </>
    );
  };
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  kiosk: state.globalState.kiosk,
  meshStatus: meshWideMTLSStatusSelector(state),
  minTLS: minTLSVersionSelector(state),
  language: languageSelector(state),
  navCollapse: state.userSettings.interface.navCollapse,
  refreshInterval: refreshIntervalSelector(state)
});

export const OverviewPage = connect(mapStateToProps)(OverviewPageComponent);
