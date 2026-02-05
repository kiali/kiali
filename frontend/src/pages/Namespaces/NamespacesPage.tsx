import * as React from 'react';
import { connect } from 'react-redux';
import { KialiAppState } from '../../store/Store';
import {
  durationSelector,
  languageSelector,
  meshWideMTLSStatusSelector,
  minTLSVersionSelector,
  refreshIntervalSelector
} from '../../store/Selectors';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import { NamespaceInfo, NamespaceStatus } from '../../types/NamespaceInfo';
import { SortField } from '../../types/SortFilters';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { RenderContent } from '../../components/Nav/Page';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { Refresh } from '../../components/Refresh/Refresh';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { NamespaceAction, NamespaceActions } from './NamespaceActions';
import { FilterSelected, StatefulFilters, StatefulFiltersRef } from '../../components/Filters/StatefulFilters';
import {
  isCurrentSortAscending,
  currentSortField,
  runFilters,
  currentDuration
} from '../../components/FilterList/FilterHelper';
import { HistoryManager, URLParam } from '../../app/History';
import * as API from '../../services/Api';
import { sortFields, sortFunc } from './Sorts';
import { availableFilters, nameFilter } from './Filters';
import { EmptyState, EmptyStateBody, EmptyStateVariant } from '@patternfly/react-core';
import { CubesIcon, SearchIcon } from '@patternfly/react-icons';
import { isMultiCluster } from '../../config';
import { addDanger } from '../../utils/AlertUtils';
import { TLSStatus } from '../../types/TLSStatus';
import { ValidationStatus } from '../../types/IstioObjects';
import { RefreshIntervalManual, RefreshIntervalPause } from 'config/Config';
import { connectRefresh } from 'components/Refresh/connectRefresh';
import { DEGRADED, FAILURE, HEALTHY, NOT_READY, Health } from '../../types/Health';
import { Show } from 'types/Common';
import { ApiError } from 'types/Api';
import { router } from '../../app/History';
import { Paths } from '../../config';
import { isParentKiosk, kioskOverviewAction as kioskAction } from '../../components/Kiosk/KioskActions';
import { store } from '../../store/ConfigStore';
import { setAIContext } from 'helpers/ChatAI';
import { KialiDispatch } from 'types/Redux';
import { t } from 'utils/I18nUtils';
import { NamespaceTrafficPolicies } from './NamespaceTrafficPolicies';
import { ControlPlane } from '../../types/Mesh';
import { GrafanaInfo, ISTIO_DASHBOARDS } from '../../types/GrafanaInfo';
import { ExternalLink } from '../../types/Dashboards';
import { PersesInfo } from '../../types/PersesInfo';
import { addError } from '../../utils/AlertUtils';
import { MessageType } from '../../types/NotificationCenter';
import { gvkType, IstioConfigList } from 'types/IstioConfigList';
import { getGVKTypeString } from '../../utils/IstioConfigUtils';
import { serverConfig } from '../../config';

// Maximum number of namespaces to include in a single backend API call
const MAX_NAMESPACES_PER_CALL = 100;

/**
 * Chunks an array into smaller arrays of a specified size
 * @param array The array to chunk
 * @param size The maximum size of each chunk
 * @returns An array of chunks
 */
const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

type State = {
  clusterTarget?: string;
  controlPlanes?: ControlPlane[];
  grafanaLinks: ExternalLink[];
  kind: string;
  loaded: boolean;
  namespaces: NamespaceInfo[];
  nsTarget: string;
  opTarget: string;
  persesLinks: ExternalLink[];
  showTrafficPoliciesModal: boolean;
};

type ReduxStateProps = {
  duration: DurationInSeconds;
  externalServices: any[];
  istioAPIEnabled: boolean;
  kiosk: string;
  language: string;
  meshStatus: string;
  minTLS: string;
  navCollapse: boolean;
  refreshInterval: IntervalInMilliseconds;
};

type ReduxDispatchProps = {
  dispatch: KialiDispatch;
};

type NamespacesProps = ReduxStateProps &
  ReduxDispatchProps & {
    lastRefreshAt: TimeInMilliseconds; // redux by way of ConnectRefresh
  };

export class NamespacesPageComponent extends React.Component<NamespacesProps, State> {
  private sFNamespacesToolbar: StatefulFiltersRef = React.createRef();
  private promises = new PromisesRegistry();

  // Grafana promise is only invoked by componentDidMount() no need to repeat it on componentDidUpdate()
  static grafanaInfoPromise: Promise<GrafanaInfo | undefined> | undefined;
  static persesInfoPromise: Promise<PersesInfo | undefined> | undefined;

  private kioskNamespacesAction = (
    showType: Show,
    namespace: string,
    duration: DurationInSeconds,
    refreshInterval: IntervalInMilliseconds
  ): void => {
    // For GRAPH and ISTIO_CONFIG, use the existing kiosk action
    // Convert Show enum from Namespaces to the one expected by kiosk action
    if (showType === Show.GRAPH || showType === Show.ISTIO_CONFIG) {
      // kiosk action expects a different Show enum type, but enum values are the same
      kioskAction(showType as any, namespace, duration, refreshInterval);
      return;
    }

    // For other types, handle them directly
    let showInParent = '';
    switch (showType) {
      case Show.APPLICATIONS:
        showInParent = `/${Paths.APPLICATIONS}?namespaces=${namespace}`;
        break;
      case Show.WORKLOADS:
        showInParent = `/${Paths.WORKLOADS}?namespaces=${namespace}`;
        break;
      case Show.SERVICES:
        showInParent = `/${Paths.SERVICES}?namespaces=${namespace}`;
        break;
      default:
        return;
    }
    showInParent += `&duration=${duration}&refresh=${refreshInterval}`;

    // Use the same sendParentMessage logic from KioskActions
    const targetOrigin = store.getState().globalState.kiosk;
    if (isParentKiosk(targetOrigin)) {
      window.top?.postMessage(showInParent, targetOrigin);
    }
  };

  constructor(props: NamespacesProps) {
    super(props);

    this.state = {
      clusterTarget: '',
      controlPlanes: undefined,
      grafanaLinks: [],
      kind: '',
      loaded: false,
      namespaces: [],
      nsTarget: '',
      opTarget: '',
      persesLinks: [],
      showTrafficPoliciesModal: false
    };
  }

  componentDidMount(): void {
    this.fetchGrafanaInfo();
    this.fetchPersesInfo();
    if (this.props.refreshInterval !== RefreshIntervalManual && HistoryManager.getRefresh() !== RefreshIntervalManual) {
      this.load();
    }
  }

  componentDidUpdate(prevProps: NamespacesProps): void {
    if (
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      (this.props.refreshInterval !== RefreshIntervalManual &&
        (prevProps.navCollapse !== this.props.navCollapse ||
          (prevProps.refreshInterval !== this.props.refreshInterval &&
            this.props.refreshInterval !== RefreshIntervalPause)))
    ) {
      this.load();
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  onChange = (): void => {
    if (this.props.refreshInterval !== RefreshIntervalManual && HistoryManager.getRefresh() !== RefreshIntervalManual) {
      this.load();
    }
  };

  load = (): void => {
    this.promises.cancelAll();

    this.promises
      .register('namespaces', API.getNamespaces())
      .then(namespacesResponse => {
        const nameFilters = FilterSelected.getSelected().filters.filter(f => f.category === nameFilter.category);

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
              isControlPlane: ns.isControlPlane,
              status: previous ? previous.status : undefined,
              statusApp: previous ? previous.statusApp : undefined,
              statusService: previous ? previous.statusService : undefined,
              statusWorkload: previous ? previous.statusWorkload : undefined,
              tlsStatus: previous ? previous.tlsStatus : undefined,
              validations: previous ? previous.validations : undefined,
              istioConfig: previous ? previous.istioConfig : undefined,
              labels: ns.labels,
              annotations: ns.annotations,
              revision: ns.revision
            };
          });

        // Default to namespace sort (ascending) if no sort is specified in URL
        const urlSort = HistoryManager.getParam(URLParam.SORT);
        const urlDirection = HistoryManager.getParam(URLParam.DIRECTION);
        const isAscending = urlSort && urlDirection ? isCurrentSortAscending() : true;
        const sortField = urlSort
          ? currentSortField(sortFields)
          : sortFields.find(sf => sf.id === 'namespace') || sortFields[0];

        // Set URL params if not present to ensure default sort is reflected in URL
        if (!urlSort) {
          HistoryManager.setParam(URLParam.SORT, sortField.param);
        }
        if (!urlDirection) {
          HistoryManager.setParam(URLParam.DIRECTION, 'asc');
        }

        // Set state before actually fetching health
        this.setState(
          {
            loaded: true,
            namespaces: sortFunc(allNamespaces, sortField, isAscending)
          },
          () => {
            this.fetchHealth(isAscending, sortField);
            this.fetchTLS(isAscending, sortField);
            this.fetchValidations(isAscending, sortField);

            setAIContext(this.props.dispatch, `Namespaces list: ${this.state.namespaces.map(ns => ns.name).join(',')}`);
            this.fetchControlPlanes();
          }
        );
      })
      .catch(namespacesError => {
        if (!namespacesError.isCanceled) {
          this.handleApiError('Could not fetch namespace list', namespacesError);
        }
      });
  };

  fetchHealth = (isAscending: boolean, sortField: SortField<NamespaceInfo>): void => {
    const duration = currentDuration();
    const uniqueClusters = new Set<string>();

    this.state.namespaces.forEach(namespace => {
      if (namespace.cluster) {
        uniqueClusters.add(namespace.cluster);
      }
    });

    uniqueClusters.forEach(cluster => {
      this.promises
        .registerChained('health', undefined, () =>
          this.fetchHealthForCluster(this.state.namespaces, cluster, duration)
        )
        .then(() => {
          this.setState(prevState => {
            let newNamespaces = prevState.namespaces.slice();

            if (sortField.id === 'health') {
              newNamespaces = sortFunc(newNamespaces, sortField, isAscending);
            }

            return { namespaces: newNamespaces };
          });
        });
    });
  };

  fetchHealthForCluster = async (
    namespaces: NamespaceInfo[],
    cluster: string,
    duration: DurationInSeconds
  ): Promise<void> => {
    // Filter namespaces for this cluster
    const clusterNamespaces = namespaces.filter(ns => ns.cluster === cluster);

    // Chunk namespaces to avoid overloading the backend and/or long URIs
    const namespaceChunks = chunkArray(clusterNamespaces, MAX_NAMESPACES_PER_CALL);

    // Make single API call for each chunk (without type parameter)
    const healthPromises = namespaceChunks.map(chunk => {
      const namespacesStr = chunk.map(ns => ns.name).join(',');
      return API.getClustersHealth(namespacesStr, duration, cluster);
    });

    return Promise.all(healthPromises)
      .then(chunkedResults => {
        // Process results from all chunks
        namespaceChunks.forEach((chunk, chunkIndex) => {
          const result = chunkedResults[chunkIndex];

          chunk.forEach(nsInfo => {
            if ((nsInfo.cluster && nsInfo.cluster === cluster) || !nsInfo.cluster) {
              const nsHealth = result.get(nsInfo.name);
              if (nsHealth) {
                // Process app health
                if (nsHealth.appHealth && Object.keys(nsHealth.appHealth).length > 0) {
                  const nsStatus: NamespaceStatus = {
                    inNotReady: [],
                    inError: [],
                    inWarning: [],
                    inSuccess: [],
                    notAvailable: []
                  };
                  Object.keys(nsHealth.appHealth).forEach(k => {
                    const health: Health = nsHealth.appHealth[k];
                    const status = health.getStatus();
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
                  nsInfo.statusApp = nsStatus;
                }

                // Process service health
                if (nsHealth.serviceHealth && Object.keys(nsHealth.serviceHealth).length > 0) {
                  const nsStatus: NamespaceStatus = {
                    inNotReady: [],
                    inError: [],
                    inWarning: [],
                    inSuccess: [],
                    notAvailable: []
                  };
                  Object.keys(nsHealth.serviceHealth).forEach(k => {
                    const health: Health = nsHealth.serviceHealth[k];
                    const status = health.getStatus();
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
                  nsInfo.statusService = nsStatus;
                }

                // Process workload health
                if (nsHealth.workloadHealth && Object.keys(nsHealth.workloadHealth).length > 0) {
                  const nsStatus: NamespaceStatus = {
                    inNotReady: [],
                    inError: [],
                    inWarning: [],
                    inSuccess: [],
                    notAvailable: []
                  };
                  Object.keys(nsHealth.workloadHealth).forEach(k => {
                    const health: Health = nsHealth.workloadHealth[k];
                    const status = health.getStatus();
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
                  nsInfo.statusWorkload = nsStatus;
                }
              }
            }
          });
        });
      })
      .catch(err => this.handleApiError('Could not fetch health', err));
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
              newNamespaces = sortFunc(newNamespaces, sortField, isAscending);
            }

            return { namespaces: newNamespaces };
          });
        });
    });
  };

  fetchTLSForCluster = async (namespaces: NamespaceInfo[], cluster: string): Promise<void> => {
    // Filter namespaces for this cluster
    const clusterNamespaces = namespaces.filter(ns => ns.cluster === cluster);

    // Chunk namespaces to avoid overloading the backend
    const namespaceChunks = chunkArray(clusterNamespaces, MAX_NAMESPACES_PER_CALL);

    // Make parallel API calls for each chunk
    const tlsPromises = namespaceChunks.map(chunk => API.getClustersTls(chunk.map(ns => ns.name).join(','), cluster));

    return Promise.all(tlsPromises)
      .then(chunkedResults => {
        const tlsByClusterAndNamespace = new Map<string, Map<string, TLSStatus>>();

        // Merge results from all chunks
        chunkedResults.forEach(results => {
          results.data.forEach(tls => {
            if (tls.cluster && !tlsByClusterAndNamespace.has(tls.cluster)) {
              tlsByClusterAndNamespace.set(tls.cluster, new Map<string, TLSStatus>());
            }
            if (tls.cluster && tls.namespace) {
              tlsByClusterAndNamespace.get(tls.cluster)!.set(tls.namespace, tls);
            }
          });
        });

        namespaces.forEach(nsInfo => {
          if (nsInfo.cluster && nsInfo.cluster === cluster && tlsByClusterAndNamespace.get(cluster)) {
            const tlsStatus = tlsByClusterAndNamespace.get(cluster)!.get(nsInfo.name);
            if (tlsStatus) {
              nsInfo.tlsStatus = {
                status: tlsStatus.status,
                autoMTLSEnabled: tlsStatus.autoMTLSEnabled,
                minTLS: tlsStatus.minTLS
              };
            }
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
            // The mutations to istioConfig and validations are already applied to prevState.namespaces
            // Create a new array reference to ensure React detects the state change
            let newNamespaces = prevState.namespaces.slice();

            if (sortField.id === 'validations') {
              newNamespaces = sortFunc(newNamespaces, sortField, isAscending);
            }

            return { namespaces: newNamespaces };
          });
        });
    });
  };

  fetchValidationResultForCluster = async (namespaces: NamespaceInfo[], cluster: string): Promise<void> => {
    // Filter namespaces for this cluster
    const clusterNamespaces = namespaces.filter(ns => ns.cluster === cluster);

    // Chunk namespaces to avoid overloading the backend
    const namespaceChunks = chunkArray(clusterNamespaces, MAX_NAMESPACES_PER_CALL);

    // Make parallel API calls for validation chunks
    const validationPromises = namespaceChunks.map(chunk =>
      API.getConfigValidations(chunk.map(ns => ns.name).join(','), cluster)
    );

    return Promise.all([Promise.all(validationPromises), API.getAllIstioConfigs([], false, '', '', cluster)])
      .then(([validationResults, istioConfigResult]) => {
        const istioConfig = istioConfigResult.data;

        const validationsByClusterAndNamespace = new Map<string, Map<string, ValidationStatus>>();

        // Merge validations from all chunks
        validationResults.forEach(validationResult => {
          validationResult.data.forEach(validation => {
            if (validation.cluster && !validationsByClusterAndNamespace.has(validation.cluster)) {
              validationsByClusterAndNamespace.set(validation.cluster, new Map<string, ValidationStatus>());
            }
            if (validation.cluster && validation.namespace) {
              validationsByClusterAndNamespace.get(validation.cluster)!.set(validation.namespace, validation);
            }
          });
        });

        const istioConfigPerNamespace = new Map<string, IstioConfigList>();
        Object.entries(istioConfig.resources).forEach(([key, configListField]) => {
          if (configListField && Array.isArray(configListField)) {
            configListField.forEach(istioObject => {
              if (!istioConfigPerNamespace.has(istioObject.metadata.namespace)) {
                const newIstioConfigList: IstioConfigList = {
                  permissions: {},
                  resources: {},
                  validations: {}
                };
                istioConfigPerNamespace.set(istioObject.metadata.namespace, newIstioConfigList);
              }
              if (!istioConfigPerNamespace.get(istioObject.metadata.namespace)!['resources'][key]) {
                istioConfigPerNamespace.get(istioObject.metadata.namespace)!['resources'][key] = [];
              }
              istioConfigPerNamespace.get(istioObject.metadata.namespace)!['resources'][key].push(istioObject);
            });
          }
        });

        // Update namespaces with validations and istioConfig
        // We need to mutate the array passed in (which is this.state.namespaces)
        // so that the changes are reflected when setState is called
        namespaces.forEach(nsInfo => {
          if (nsInfo.cluster && nsInfo.cluster === cluster) {
            if (validationsByClusterAndNamespace.get(cluster)) {
              nsInfo.validations = validationsByClusterAndNamespace.get(cluster)!.get(nsInfo.name);
            }
            // Set istioConfig - use the one from the map, or create an empty one if not found
            const nsIstioConfig = istioConfigPerNamespace.get(nsInfo.name);
            if (nsIstioConfig) {
              nsInfo.istioConfig = nsIstioConfig;
            } else if (!nsInfo.istioConfig) {
              // Only set empty config if it doesn't already exist (to preserve existing data)
              nsInfo.istioConfig = {
                permissions: {},
                resources: {},
                validations: {}
              };
            }
          }
        });
      })
      .catch(err => this.handleApiError('Could not fetch validations status', err));
  };

  fetchGrafanaInfo = (): void => {
    if (this.props.externalServices.find(service => service.name.toLowerCase() === 'grafana')) {
      if (!NamespacesPageComponent.grafanaInfoPromise) {
        NamespacesPageComponent.grafanaInfoPromise = API.getGrafanaInfo().then(response => {
          if (response.status === 204) {
            return undefined;
          }

          return response.data;
        });
      }

      NamespacesPageComponent.grafanaInfoPromise
        .then(grafanaInfo => {
          if (grafanaInfo) {
            // For Namespaces Page only Performance and Wasm Extension dashboard are interesting
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

  fetchPersesInfo = (): void => {
    if (this.props.externalServices.find(service => service.name.toLowerCase() === 'perses')) {
      if (!NamespacesPageComponent.persesInfoPromise) {
        NamespacesPageComponent.persesInfoPromise = API.getPersesInfo().then(response => {
          if (response.status === 204) {
            return undefined;
          }

          return response.data;
        });
      }

      NamespacesPageComponent.persesInfoPromise
        .then(persesInfo => {
          if (persesInfo) {
            // For Namespaces Page only Performance and Wasm Extension dashboard are interesting
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

  private fetchControlPlanes = async (): Promise<void> => {
    return API.getControlPlanes()
      .then(response => {
        this.setState({
          controlPlanes: response.data
        });
      })
      .catch(err => {
        addError('Error fetching control planes.', err);
      });
  };

  handleApiError = (message: string, error: ApiError): void => {
    addDanger(message, API.getErrorString(error));
  };

  sort = (sortField: SortField<NamespaceInfo>, isAscending: boolean): void => {
    this.setState(prevState => {
      return {
        namespaces: sortFunc(prevState.namespaces, sortField, isAscending)
      };
    });
  };

  getNamespaceActions = (nsInfo: NamespaceInfo): NamespaceAction[] => {
    // Today actions are fixed, but soon actions may depend of the state of a namespace
    // So we keep this wrapped in a showActions function.
    const namespaceActions: NamespaceAction[] = isParentKiosk(this.props.kiosk)
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
                  this.kioskNamespacesAction(Show.GRAPH, ns, this.props.duration, this.props.refreshInterval)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Istio Config',
                action: (ns: string) =>
                  this.kioskNamespacesAction(Show.ISTIO_CONFIG, ns, this.props.duration, this.props.refreshInterval)
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
                action: (ns: string) => this.show(Show.GRAPH, ns)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Applications',
                action: (ns: string) => this.show(Show.APPLICATIONS, ns)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Workloads',
                action: (ns: string) => this.show(Show.WORKLOADS, ns)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Services',
                action: (ns: string) => this.show(Show.SERVICES, ns)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Istio Config',
                action: (ns: string) => this.show(Show.ISTIO_CONFIG, ns)
              }
            ]
          }
        ];
    // We are going to assume that if the user can create/update Istio AuthorizationPolicies in a namespace
    // then it can use the Istio Injection Actions.
    // RBAC allow more fine granularity but Kiali won't check that in detail.

    if (!nsInfo.isControlPlane) {
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
          title: t('Enable Auto Injection'),
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
          title: t('Disable Auto Injection'),
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
          title: t('Remove Auto Injection'),
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

      // Ambient actions
      if (serverConfig.ambientEnabled) {
        const addAmbientAction = {
          'data-test': `add-${nsInfo.name}-namespace-ambient`,
          isGroup: false,
          isSeparator: false,
          title: t('Add to Ambient'),
          action: (ns: string) =>
            this.setState({
              showTrafficPoliciesModal: true,
              nsTarget: ns,
              opTarget: 'enable',
              kind: 'ambient',
              clusterTarget: nsInfo.cluster
            })
        };

        const disableAmbientAction = {
          'data-test': `disable-${nsInfo.name}-namespace-ambient`,
          isGroup: false,
          isSeparator: false,
          title: 'Disable Ambient',
          action: (ns: string) =>
            this.setState({
              showTrafficPoliciesModal: true,
              nsTarget: ns,
              opTarget: 'disable',
              kind: 'ambient',
              clusterTarget: nsInfo.cluster
            })
        };

        const removeAmbientAction = {
          'data-test': `remove-${nsInfo.name}-namespace-ambient`,
          isGroup: false,
          isSeparator: false,
          title: 'Remove Ambient',
          action: (ns: string) =>
            this.setState({
              showTrafficPoliciesModal: true,
              nsTarget: ns,
              opTarget: 'remove',
              kind: 'ambient',
              clusterTarget: nsInfo.cluster
            })
        };

        if (
          nsInfo.labels &&
          !nsInfo.labels[serverConfig.istioLabels.injectionLabelName] &&
          !nsInfo.labels[serverConfig.istioLabels.injectionLabelRev]
        ) {
          if (nsInfo.isAmbient) {
            namespaceActions.push({
              isGroup: false,
              isSeparator: true
            });
            namespaceActions.push(disableAmbientAction);
            namespaceActions.push(removeAmbientAction);
          } else {
            namespaceActions.push(addAmbientAction);
          }
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

      const aps = nsInfo.istioConfig?.resources[getGVKTypeString(gvkType.AuthorizationPolicy)] ?? [];

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
    } else {
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
              this.onChange();
            }
          };

          namespaceActions.push(grafanaDashboard);
        });
      }
      if (this.state.persesLinks.length > 0) {
        // Istio namespace will render external Perses dashboards
        namespaceActions.push({
          isGroup: false,
          isSeparator: true
        });

        this.state.persesLinks.forEach(link => {
          const persesDashboard = {
            isGroup: false,
            isSeparator: false,
            isExternal: true,
            title: link.name,
            action: (_ns: string) => {
              window.open(link.url, '_blank');
              this.onChange();
            }
          };

          namespaceActions.push(persesDashboard);
        });
      }
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

  show = (showType: Show, namespace: string): void => {
    let destination = '';

    switch (showType) {
      case Show.GRAPH:
        destination = `/graph/namespaces?namespaces=${namespace}`;
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

    if (destination) {
      if (isParentKiosk(this.props.kiosk)) {
        this.kioskNamespacesAction(showType, namespace, this.props.duration, this.props.refreshInterval);
      } else {
        router.navigate(destination);
      }
    }
  };

  getEmptyState = (): React.ReactNode => {
    const hasFilters = FilterSelected.getSelected().filters.length > 0;

    if (hasFilters) {
      return (
        <EmptyState
          headingLevel="h5"
          icon={SearchIcon}
          titleText={t('No namespaces found')}
          variant={EmptyStateVariant.lg}
        >
          <EmptyStateBody>{t('No results match the filter criteria. Clear all filters and try again.')}</EmptyStateBody>
        </EmptyState>
      );
    }

    return (
      <EmptyState
        headingLevel="h5"
        icon={CubesIcon}
        titleText={t('No namespaces found')}
        variant={EmptyStateVariant.lg}
      >
        <EmptyStateBody>
          {t('No namespaces are accessible. Check your permissions or contact an administrator.')}
        </EmptyStateBody>
      </EmptyState>
    );
  };

  render(): React.ReactNode {
    const filteredNamespaces = runFilters(this.state.namespaces, availableFilters, FilterSelected.getSelected());

    const namespaceActions = filteredNamespaces.map((ns, i) => {
      const actions = this.getNamespaceActions(ns);
      return <NamespaceActions key={`namespaceAction_${i}`} namespace={ns.name} actions={actions} />;
    });

    const hiddenColumns = isMultiCluster ? [] : ['cluster'];
    if (!serverConfig.kialiFeatureFlags.istioUpgradeAction) {
      hiddenColumns.push('revision');
    }

    return (
      <>
        <DefaultSecondaryMasthead
          hideNamespaceSelector={true}
          rightToolbar={<Refresh id="namespaces-list-refresh" disabled={false} manageURL={true} />}
        />
        <RenderContent>
          <VirtualList
            emptyState={this.getEmptyState()}
            loaded={this.state.loaded}
            refreshInterval={this.props.refreshInterval}
            rows={filteredNamespaces}
            sort={this.sort}
            statefulProps={this.sFNamespacesToolbar}
            actions={namespaceActions}
            hiddenColumns={hiddenColumns}
            type="namespaces"
          >
            <StatefulFilters
              initialFilters={availableFilters}
              onFilterChange={this.onChange}
              ref={this.sFNamespacesToolbar}
            />
          </VirtualList>
        </RenderContent>

        <NamespaceTrafficPolicies
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
          load={this.onChange}
        />
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  duration: durationSelector(state),
  externalServices: state.statusState.externalServices,
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  kiosk: state.globalState.kiosk,
  language: languageSelector(state),
  meshStatus: meshWideMTLSStatusSelector(state),
  minTLS: minTLSVersionSelector(state),
  navCollapse: state.userSettings.interface.navCollapse,
  refreshInterval: refreshIntervalSelector(state)
});

export const NamespacesPage = connectRefresh(connect(mapStateToProps)(NamespacesPageComponent));
