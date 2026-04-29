import * as React from 'react';
import { connect } from 'react-redux';
import { KialiAppState } from '../../store/Store';
import {
  languageSelector,
  meshWideMTLSStatusSelector,
  minTLSVersionSelector,
  refreshIntervalSelector
} from '../../store/Selectors';
import { IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import { SortField } from '../../types/SortFilters';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { RenderContent } from '../../components/Nav/Page';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { Refresh } from '../../components/Refresh/Refresh';
import { HealthComputeDurationMastheadToolbar } from 'components/Time/HealthComputeDurationMastheadToolbar';
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { FilterSelected, StatefulFilters, StatefulFiltersRef } from '../../components/Filters/StatefulFilters';
import { isCurrentSortAscending, currentSortField, runFilters } from '../../components/FilterList/FilterHelper';
import { HistoryManager, URLParam } from '../../app/History';
import * as API from '../../services/Api';
import { sortFields, sortFunc } from './Sorts';
import { availableFilters, nameFilter } from './Filters';
import { EmptyState, EmptyStateBody, EmptyStateVariant } from '@patternfly/react-core';
import { CubesIcon, SearchIcon } from '@patternfly/react-icons';
import { isMultiCluster } from '../../config';
import { addDanger } from '../../utils/AlertUtils';
import { arrayEquals } from '../../utils/Common';
import { MTLSStatuses, TLSStatus } from '../../types/TLSStatus';
import { ValidationStatus } from '../../types/IstioObjects';
import { RefreshIntervalManual, RefreshIntervalPause } from 'config/Config';
import { connectRefresh } from 'components/Refresh/connectRefresh';
import { ApiError } from 'types/Api';
import { setAIContext } from 'helpers/ChatAI';
import { KialiDispatch } from 'types/Redux';
import { t } from 'utils/I18nUtils';
import { ControlPlane } from '../../types/Mesh';
import { addError } from '../../utils/AlertUtils';
import { IstioConfigList } from 'types/IstioConfigList';
import { serverConfig } from '../../config';
import { fetchClusterNamespacesHealth } from '../../services/NamespaceHealth';
import { config as virtualListConfig } from '../../components/VirtualList/Config';
import {
  ColumnManagementModalColumn,
  ListColumnManagementModal
} from '../../components/Filters/ListColumnManagementModal';
import { ManagedColumn } from '../../components/VirtualList/ManagedColumnTypes';
import { NamespacesListActions } from '../../actions/NamespacesListActions';
import { setControlPlaneRevisions } from './NamespaceRevisionUtils';

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
  controlPlanes?: ControlPlane[];
  loaded: boolean;
  namespaces: NamespaceInfo[];
  showColumnManagement: boolean;
};

type ReduxStateProps = {
  columnOrder: string[];
  hiddenColumnIds: string[];
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
  private sFStatefulFilters: StatefulFiltersRef = React.createRef();
  private promises = new PromisesRegistry();

  constructor(props: NamespacesProps) {
    super(props);

    this.state = {
      controlPlanes: undefined,
      loaded: false,
      namespaces: [],
      showColumnManagement: false
    };
  }

  componentDidMount(): void {
    this.syncColumnsFromURL();
    if (this.props.refreshInterval !== RefreshIntervalManual && HistoryManager.getRefresh() !== RefreshIntervalManual) {
      this.load();
    }
  }

  componentDidUpdate(prevProps: NamespacesProps): void {
    const refreshChanged =
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      (this.props.refreshInterval !== RefreshIntervalManual &&
        (prevProps.navCollapse !== this.props.navCollapse ||
          (prevProps.refreshInterval !== this.props.refreshInterval &&
            (this.props.refreshInterval !== RefreshIntervalPause ||
              prevProps.refreshInterval === RefreshIntervalManual))));

    if (refreshChanged) {
      this.load();
    }
  }

  private syncColumnsFromURL = (): void => {
    const defaultIds = this.getDefaultManagedColumns().map(c => c.id);
    const validIds = defaultIds.filter(id => id !== 'namespace');

    const urlParam = HistoryManager.getParam(URLParam.NAMESPACES_HIDDEN_COLUMNS);
    if (urlParam !== undefined) {
      const ids = urlParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const filtered = ids.filter(id => validIds.includes(id));
      if (filtered.length > 0 && !arrayEquals(filtered, this.props.hiddenColumnIds, (a, b) => a === b)) {
        this.props.dispatch(NamespacesListActions.setHiddenColumns(filtered));
      } else if (filtered.length === 0 && this.props.hiddenColumnIds.length > 0) {
        this.props.dispatch(NamespacesListActions.setHiddenColumns([]));
      }
    } else if (this.props.hiddenColumnIds.length > 0) {
      HistoryManager.setParam(URLParam.NAMESPACES_HIDDEN_COLUMNS, this.props.hiddenColumnIds.join(','));
    }

    const orderParam = HistoryManager.getParam(URLParam.NAMESPACES_COLUMN_ORDER);
    if (orderParam !== undefined) {
      const orderIds = orderParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const validOrder = orderIds.filter(id => defaultIds.includes(id));
      if (validOrder.length > 0 && !arrayEquals(validOrder, this.props.columnOrder, (a, b) => a === b)) {
        this.props.dispatch(NamespacesListActions.setColumnOrder(validOrder));
      } else if (validOrder.length === 0 && this.props.columnOrder.length > 0) {
        this.props.dispatch(NamespacesListActions.setColumnOrder([]));
      }
    } else if (this.props.columnOrder.length > 0) {
      HistoryManager.setParam(URLParam.NAMESPACES_COLUMN_ORDER, this.props.columnOrder.join(','));
    }
  };

  private getDefaultManagedColumns = (): ManagedColumn[] => {
    return virtualListConfig.namespaces.columns
      .filter(c => c.title && c.title.trim().length > 0)
      .map(c => {
        const id = (c.id ?? c.name.toLowerCase()).toLowerCase();
        return {
          id,
          title: c.title,
          isShown: true,
          isDisabled: id === 'namespace'
        } as ManagedColumn;
      });
  };

  private getManagedColumns = (): ManagedColumn[] => {
    const defaultCols = this.getDefaultManagedColumns();
    const hiddenSet = new Set(this.props.hiddenColumnIds);
    let ordered = defaultCols;
    if (this.props.columnOrder && this.props.columnOrder.length > 0) {
      const orderMap = new Map(this.props.columnOrder.map((id, i) => [id, i]));
      ordered = [...defaultCols].sort((a, b) => {
        const ai = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bi = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
    }
    return ordered.map(c => ({
      ...c,
      isShown: !hiddenSet.has(c.id) // isShown when not in hidden set
    }));
  };

  private resetNamespaceColumnsToDefault = (): void => {
    this.props.dispatch(NamespacesListActions.setColumnOrder([]));
    this.props.dispatch(NamespacesListActions.setHiddenColumns([]));
    HistoryManager.deleteParam(URLParam.NAMESPACES_COLUMN_ORDER);
    HistoryManager.deleteParam(URLParam.NAMESPACES_HIDDEN_COLUMNS);
  };

  /** Columns in the format expected by {@link ListColumnManagementModal} */
  private getAppliedColumnsForModal = (): ColumnManagementModalColumn[] => {
    return this.getManagedColumns().map(c => ({
      key: c.id,
      title: c.title,
      isShownByDefault: true,
      isShown: c.isShown,
      isUntoggleable: c.id === 'namespace'
    }));
  };

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
              annotations: ns.annotations,
              cluster: ns.cluster,
              isAmbient: ns.isAmbient,
              isControlPlane: ns.isControlPlane,
              istioConfig: previous ? previous.istioConfig : undefined,
              labels: ns.labels,
              name: ns.name,
              revision: ns.revision,
              status: previous ? previous.status : undefined,
              statusApp: previous ? previous.statusApp : undefined,
              statusService: previous ? previous.statusService : undefined,
              statusWorkload: previous ? previous.statusWorkload : undefined,
              tlsStatus: previous ? previous.tlsStatus : undefined,
              validations: previous ? previous.validations : undefined,
              worstStatus: previous ? previous.worstStatus : undefined
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
    const uniqueClusters = new Set<string>();

    this.state.namespaces.forEach(namespace => {
      if (namespace.cluster) {
        uniqueClusters.add(namespace.cluster);
      }
    });

    uniqueClusters.forEach(cluster => {
      this.promises
        .registerChained('health', undefined, () => this.fetchHealthForCluster(this.state.namespaces, cluster))
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

  fetchHealthForCluster = async (namespaces: NamespaceInfo[], cluster: string): Promise<void> => {
    try {
      // Filter namespaces for this cluster
      const clusterNamespaces = namespaces.filter(ns => ns.cluster === cluster);
      const healthByNamespace = await fetchClusterNamespacesHealth(
        clusterNamespaces.map(ns => ns.name),
        cluster
      );

      clusterNamespaces.forEach(nsInfo => {
        const nsHealth = healthByNamespace.get(nsInfo.name);
        if (!nsHealth) {
          nsInfo.statusApp = undefined;
          nsInfo.statusService = undefined;
          nsInfo.statusWorkload = undefined;
          nsInfo.worstStatus = undefined;
          return;
        }
        nsInfo.statusApp = nsHealth.statusApp;
        nsInfo.statusService = nsHealth.statusService;
        nsInfo.statusWorkload = nsHealth.statusWorkload;
        nsInfo.worstStatus = nsHealth.worstStatus;
      });
    } catch (err) {
      this.handleApiError('Could not fetch health', err as ApiError);
    }
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
                status: this.resolveNamespaceTlsStatusForDisplay(tlsStatus.status),
                autoMTLSEnabled: tlsStatus.autoMTLSEnabled,
                minTLS: tlsStatus.minTLS
              };
            }
          }
        });
      })
      .catch(err => this.handleApiError('Could not fetch TLS status', err));
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

    // Mesh-wide mTLS "not specified" effectively defaults to PERMISSIVE in Istio.
    return MTLSStatuses.UNSET_INHERITED_PERMISSIVE;
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

  private fetchControlPlanes = async (): Promise<void> => {
    return API.getControlPlanes()
      .then(response => {
        const controlPlanes = response.data;
        setControlPlaneRevisions(new Set(controlPlanes.map(cp => cp.revision)));
        this.setState({ controlPlanes });
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

    const hiddenColumns = isMultiCluster ? [] : ['cluster'];
    if (!serverConfig.kialiFeatureFlags.istioUpgradeAction) {
      hiddenColumns.push('revision');
    }
    const userHidden = this.props.hiddenColumnIds;
    const allHiddenColumns = hiddenColumns.concat(userHidden);

    return (
      <>
        <DefaultSecondaryMasthead
          hideNamespaceSelector={true}
          rightToolbar={
            <HealthComputeDurationMastheadToolbar>
              <Refresh id="namespaces-list-refresh" disabled={false} manageURL={true} />
            </HealthComputeDurationMastheadToolbar>
          }
        />
        <RenderContent>
          <VirtualList
            emptyState={this.getEmptyState()}
            loaded={this.state.loaded}
            refreshInterval={this.props.refreshInterval}
            rows={filteredNamespaces}
            sort={this.sort}
            statefulProps={this.sFStatefulFilters}
            columnOrder={this.props.columnOrder}
            hiddenColumns={allHiddenColumns}
            type="namespaces"
          >
            <StatefulFilters
              columnManagement={true}
              columnManagementButtonTestId="namespaces-manage-columns"
              initialFilters={availableFilters}
              onColumnManagementClick={() => this.setState({ showColumnManagement: true })}
              onFilterChange={this.onChange}
              ref={this.sFStatefulFilters}
            />
          </VirtualList>
        </RenderContent>

        <ListColumnManagementModal
          appliedColumns={this.getAppliedColumnsForModal()}
          applyColumns={newColumns => {
            const hiddenIds = newColumns.filter(c => !c.isShown).map(c => c.key);
            const orderedIds = newColumns.map(c => c.key);
            this.props.dispatch(NamespacesListActions.setColumnOrder(orderedIds));
            if (orderedIds.length > 0) {
              HistoryManager.setParam(URLParam.NAMESPACES_COLUMN_ORDER, orderedIds.join(','));
            } else {
              HistoryManager.deleteParam(URLParam.NAMESPACES_COLUMN_ORDER);
            }

            this.props.dispatch(NamespacesListActions.setHiddenColumns(hiddenIds));
            if (hiddenIds.length > 0) {
              HistoryManager.setParam(URLParam.NAMESPACES_HIDDEN_COLUMNS, hiddenIds.join(','));
            } else {
              HistoryManager.deleteParam(URLParam.NAMESPACES_HIDDEN_COLUMNS);
            }

            this.setState({ showColumnManagement: false });
          }}
          description={t('Selected categories will be displayed in the table. Drag and drop to reorder columns.')}
          enableDragDrop={true}
          isOpen={this.state.showColumnManagement}
          onClose={() => this.setState({ showColumnManagement: false })}
          onResetToDefault={this.resetNamespaceColumnsToDefault}
          title={t('Manage columns')}
        />
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  columnOrder: state.namespacesList.columnOrder,
  hiddenColumnIds: state.namespacesList.hiddenColumnIds,
  kiosk: state.globalState.kiosk,
  language: languageSelector(state),
  meshStatus: meshWideMTLSStatusSelector(state),
  minTLS: minTLSVersionSelector(state),
  navCollapse: state.userSettings.interface.navCollapse,
  refreshInterval: refreshIntervalSelector(state)
});

export const NamespacesPage = connectRefresh(connect(mapStateToProps)(NamespacesPageComponent));
