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
import { TimeDurationComponent } from '../../components/Time/TimeDurationComponent';
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
import { EmptyNamespaces } from './EmptyNamespaces';
import { isMultiCluster } from '../../config';
import { kialiStyle } from 'styles/StyleUtils';
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

// Maximum number of namespaces to include in a single backend API call
const MAX_NAMESPACES_PER_CALL = 100;

const rightToolbarStyle = kialiStyle({
  position: 'absolute',
  right: '3rem'
});

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
  loaded: boolean;
  namespaces: NamespaceInfo[];
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
      loaded: false,
      namespaces: []
    };
  }

  componentDidMount(): void {
    if (this.props.refreshInterval !== RefreshIntervalManual && HistoryManager.getRefresh() !== RefreshIntervalManual) {
      this.load();
    }
  }

  componentDidUpdate(prevProps: NamespacesProps): void {
    if (
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      (this.props.refreshInterval !== RefreshIntervalManual &&
        (prevProps.duration !== this.props.duration ||
          prevProps.navCollapse !== this.props.navCollapse ||
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
              tlsStatus: previous ? previous.tlsStatus : undefined,
              validations: previous ? previous.validations : undefined,
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

            setAIContext(
              this.props.dispatch,
              `Namespaces list: ${this.state.namespaces.map(ns => ns.name).join(',')}`
            );
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

    return Promise.all(validationPromises)
      .then(chunkedResults => {
        const validationsByClusterAndNamespace = new Map<string, Map<string, ValidationStatus>>();

        // Merge validations from all chunks
        chunkedResults.forEach(validationResult => {
          validationResult.data.forEach(validation => {
            if (validation.cluster && !validationsByClusterAndNamespace.has(validation.cluster)) {
              validationsByClusterAndNamespace.set(validation.cluster, new Map<string, ValidationStatus>());
            }
            if (validation.cluster && validation.namespace) {
              validationsByClusterAndNamespace.get(validation.cluster)!.set(validation.namespace, validation);
            }
          });
        });

        namespaces.forEach(nsInfo => {
          if (nsInfo.cluster && nsInfo.cluster === cluster && validationsByClusterAndNamespace.get(cluster)) {
            nsInfo.validations = validationsByClusterAndNamespace.get(cluster)!.get(nsInfo.name);
          }
        });
      })
      .catch(err => this.handleApiError('Could not fetch validations', err));
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

  getNamespaceActions = (_nsInfo: NamespaceInfo): NamespaceAction[] => {
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

    return namespaceActions;
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

  render(): React.ReactNode {
    const filteredNamespaces = runFilters(this.state.namespaces, availableFilters, FilterSelected.getSelected());

    const namespaceActions = filteredNamespaces.map((ns, i) => {
      const actions = this.getNamespaceActions(ns);
      return <NamespaceActions key={`namespaceAction_${i}`} namespace={ns.name} actions={actions} />;
    });

    const hiddenColumns = isMultiCluster ? [] : ['cluster'];

    return (
      <>
        <DefaultSecondaryMasthead
          hideNamespaceSelector={true}
          rightToolbar={
            <div className={rightToolbarStyle}>
              <TimeDurationComponent key="DurationDropdown" id="namespaces-list-duration-dropdown" disabled={false} />
            </div>
          }
        />
        <EmptyNamespaces
          filteredNamespaces={filteredNamespaces}
          loaded={this.state.loaded}
          refreshInterval={this.props.refreshInterval}
        >
          <RenderContent>
            <VirtualList
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
        </EmptyNamespaces>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  duration: durationSelector(state),
  externalServices: [],
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  kiosk: state.globalState.kiosk,
  language: languageSelector(state),
  meshStatus: meshWideMTLSStatusSelector(state),
  minTLS: minTLSVersionSelector(state),
  navCollapse: state.userSettings.interface.navCollapse,
  refreshInterval: refreshIntervalSelector(state)
});

export const NamespacesPage = connectRefresh(connect(mapStateToProps)(NamespacesPageComponent));
