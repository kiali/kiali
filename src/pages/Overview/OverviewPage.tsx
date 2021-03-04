import * as React from 'react';
import {
  Button,
  Card,
  CardActions,
  CardBody,
  CardHead,
  CardHeader,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Grid,
  GridItem,
  Modal,
  Title,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { style } from 'typestyle';
import { AxiosError } from 'axios';
import _ from 'lodash';
import { FilterSelected, StatefulFilters } from '../../components/Filters/StatefulFilters';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import * as API from '../../services/Api';
import {
  DEGRADED,
  FAILURE,
  Health,
  HEALTHY,
  NOT_READY,
  NamespaceAppHealth,
  NamespaceServiceHealth,
  NamespaceWorkloadHealth
} from '../../types/Health';
import { SortField } from '../../types/SortFilters';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import OverviewToolbarContainer, { OverviewDisplayMode, OverviewToolbar, OverviewType } from './OverviewToolbar';
import NamespaceInfo, { NamespaceStatus } from './NamespaceInfo';
import NamespaceMTLSStatusContainer from '../../components/MTls/NamespaceMTLSStatus';
import { RenderComponentScroll } from '../../components/Nav/Page';
import OverviewCardContentCompact from './OverviewCardContentCompact';
import OverviewCardContentExpanded from './OverviewCardContentExpanded';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { computePrometheusRateParams } from '../../services/Prometheus';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { durationSelector, meshWideMTLSStatusSelector, refreshIntervalSelector } from '../../store/Selectors';
import { nsWideMTLSStatus } from '../../types/TLSStatus';
import { switchType } from './OverviewHelper';
import * as Sorts from './Sorts';
import * as Filters from './Filters';
import ValidationSummary from '../../components/Validations/ValidationSummary';
import { DurationInSeconds, IntervalInMilliseconds } from 'types/Common';
import { Link } from 'react-router-dom';
import { Paths, serverConfig } from '../../config';
import { PfColors } from '../../components/Pf/PfColors';
import VirtualList from '../../components/VirtualList/VirtualList';
import { OverviewNamespaceAction, OverviewNamespaceActions } from './OverviewNamespaceActions';
import history, { HistoryManager, URLParam } from '../../app/History';
import {
  buildGraphAuthorizationPolicy,
  buildNamespaceInjectionPatch
} from '../../components/IstioWizards/WizardActions';
import * as AlertUtils from '../../utils/AlertUtils';
import { MessageType } from '../../types/MessageCenter';
import GraphDataSource from '../../services/GraphDataSource';
import { AuthorizationPolicy } from '../../types/IstioObjects';
import { IstioPermissions } from '../../types/IstioConfigDetails';
import { AUTHORIZATION_POLICIES } from '../IstioConfigNew/AuthorizationPolicyForm';

const gridStyleCompact = style({
  backgroundColor: '#f5f5f5',
  paddingBottom: '20px',
  marginTop: '0px'
});

const gridStyleList = style({
  backgroundColor: '#f5f5f5',
  // The VirtualTable component has a different style than cards
  // We need to adjust the grid style if we are on compact vs list view
  padding: '0 !important',
  marginTop: '0px'
});

const cardGridStyle = style({ borderTop: '2px solid #39a5dc', textAlign: 'center', marginTop: '0px' });

const emptyStateStyle = style({
  height: '300px',
  marginRight: 5,
  marginBottom: 10,
  marginTop: 10
});

const cardHeaderStyle = style({
  width: '75%',
  textAlign: 'left'
});

const cardNamespaceNameNormalStyle = style({
  display: 'inline-block',
  verticalAlign: 'middle'
});

// CSS trick to apply ellipsis only on certain cases
// With actions on Card, there are some CSS calculation in the Cards, so the
// maxWidth calc() used doesn't work well for all cases
const NS_LONG = 20;

const cardNamespaceNameLongStyle = style({
  display: 'inline-block',
  maxWidth: 'calc(100% - 75px)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap'
});

enum Show {
  GRAPH,
  APPLICATIONS,
  WORKLOADS,
  SERVICES,
  ISTIO_CONFIG
}

type State = {
  namespaces: NamespaceInfo[];
  type: OverviewType;
  displayMode: OverviewDisplayMode;
  permissions: IstioPermissions;
  showConfirmModal: boolean;
  nsTarget: string;
  opTarget: string;
};

type ReduxProps = {
  duration: DurationInSeconds;
  meshStatus: string;
  navCollapse: boolean;
  refreshInterval: IntervalInMilliseconds;
};

type OverviewProps = ReduxProps & {};

export class OverviewPage extends React.Component<OverviewProps, State> {
  private sFOverviewToolbar: React.RefObject<StatefulFilters> = React.createRef();
  private promises = new PromisesRegistry();

  constructor(props: OverviewProps) {
    super(props);
    const display = HistoryManager.getParam(URLParam.DISPLAY_MODE);
    this.state = {
      namespaces: [],
      type: OverviewToolbar.currentOverviewType(),
      displayMode: display ? Number(display) : OverviewDisplayMode.EXPAND,
      permissions: {},
      showConfirmModal: false,
      nsTarget: '',
      opTarget: ''
    };
  }

  componentDidUpdate(prevProps: OverviewProps) {
    if (prevProps.duration !== this.props.duration || prevProps.navCollapse !== this.props.navCollapse) {
      // Reload to avoid graphical glitches with charts
      // TODO: this workaround should probably be deleted after switch to Patternfly 4, see https://issues.jboss.org/browse/KIALI-3116
      this.load();
    }
  }

  componentDidMount() {
    this.load();
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  sortFields() {
    return Sorts.sortFields;
  }

  getStartDisplayMode = (isCompact: boolean) => {
    // Check if there is a displayMode option
    const historyDisplayMode = HistoryManager.getParam(URLParam.DISPLAY_MODE);
    if (historyDisplayMode) {
      return Number(historyDisplayMode);
    }

    // In this case is the first time that we are loading Overview Page, calculate the best view
    return isCompact ? OverviewDisplayMode.COMPACT : OverviewDisplayMode.EXPAND;
  };

  load = () => {
    this.promises.cancelAll();
    this.promises
      .register('namespaces', API.getNamespaces())
      .then(namespacesResponse => {
        const nameFilters = FilterSelected.getSelected().filters.filter(f => f.id === Filters.nameFilter.id);
        const allNamespaces: NamespaceInfo[] = namespacesResponse.data
          .filter(ns => {
            return nameFilters.length === 0 || nameFilters.some(f => ns.name.includes(f.value));
          })
          .map(ns => {
            const previous = this.state.namespaces.find(prev => prev.name === ns.name);
            return {
              name: ns.name,
              status: previous ? previous.status : undefined,
              tlsStatus: previous ? previous.tlsStatus : undefined,
              metrics: previous ? previous.metrics : undefined,
              validations: previous ? previous.validations : undefined,
              labels: ns.labels
            };
          });
        const isAscending = FilterHelper.isCurrentSortAscending();
        const sortField = FilterHelper.currentSortField(Sorts.sortFields);
        const type = OverviewToolbar.currentOverviewType();
        const displayMode = this.getStartDisplayMode(allNamespaces.length > 16);

        // Set state before actually fetching health
        this.setState(
          prevState => {
            return {
              type: type,
              namespaces: Sorts.sortFunc(allNamespaces, sortField, isAscending),
              displayMode: displayMode,
              showConfirmModal: prevState.showConfirmModal,
              nsTarget: prevState.nsTarget,
              opTarget: prevState.opTarget
            };
          },
          () => {
            this.fetchHealth(isAscending, sortField, type);
            this.fetchTLS(isAscending, sortField);
            this.fetchValidations(isAscending, sortField);
            this.fetchPermissions();
            if (displayMode !== OverviewDisplayMode.COMPACT) {
              this.fetchMetrics();
            }
          }
        );
      })
      .catch(namespacesError => {
        if (!namespacesError.isCanceled) {
          this.handleAxiosError('Could not fetch namespace list', namespacesError);
        }
      });
  };

  fetchHealth(isAscending: boolean, sortField: SortField<NamespaceInfo>, type: OverviewType) {
    const duration = FilterHelper.currentDuration();
    // debounce async for back-pressure, ten by ten
    _.chunk(this.state.namespaces, 10).forEach(chunk => {
      this.promises
        .registerChained('healthchunks', undefined, () => this.fetchHealthChunk(chunk, duration, type))
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
  }

  fetchHealthChunk(chunk: NamespaceInfo[], duration: number, type: OverviewType) {
    const apiFunc = switchType(
      type,
      API.getNamespaceAppHealth,
      API.getNamespaceServiceHealth,
      API.getNamespaceWorkloadHealth
    );
    return Promise.all(
      chunk.map(nsInfo => {
        const healthPromise: Promise<NamespaceAppHealth | NamespaceWorkloadHealth | NamespaceServiceHealth> = apiFunc(
          nsInfo.name,
          duration
        );
        return healthPromise.then(rs => ({ health: rs, nsInfo: nsInfo }));
      })
    )
      .then(results => {
        results.forEach(result => {
          const nsStatus: NamespaceStatus = {
            inNotReady: [],
            inError: [],
            inWarning: [],
            inSuccess: [],
            notAvailable: []
          };
          Object.keys(result.health).forEach(item => {
            const health: Health = result.health[item];
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
          result.nsInfo.status = nsStatus;
        });
      })
      .catch(err => this.handleAxiosError('Could not fetch health', err));
  }

  fetchMetrics() {
    const duration = FilterHelper.currentDuration();
    // debounce async for back-pressure, ten by ten
    _.chunk(this.state.namespaces, 10).forEach(chunk => {
      this.promises
        .registerChained('metricschunks', undefined, () => this.fetchMetricsChunk(chunk, duration))
        .then(() => {
          this.setState(prevState => {
            return { namespaces: prevState.namespaces.slice() };
          });
        });
    });
  }

  fetchMetricsChunk(chunk: NamespaceInfo[], duration: number) {
    const rateParams = computePrometheusRateParams(duration, 10);
    const optionsIn: IstioMetricsOptions = {
      filters: ['request_count'],
      duration: duration,
      step: rateParams.step,
      rateInterval: rateParams.rateInterval,
      direction: 'inbound',
      reporter: 'destination'
    };
    return Promise.all(
      chunk.map(nsInfo => {
        return API.getNamespaceMetrics(nsInfo.name, optionsIn).then(rs => {
          nsInfo.metrics = rs.data.request_count;
          return nsInfo;
        });
      })
    ).catch(err => this.handleAxiosError('Could not fetch health', err));
  }

  fetchTLS(isAscending: boolean, sortField: SortField<NamespaceInfo>) {
    _.chunk(this.state.namespaces, 10).forEach(chunk => {
      this.promises
        .registerChained('tlschunks', undefined, () => this.fetchTLSChunk(chunk))
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
  }

  fetchTLSChunk(chunk: NamespaceInfo[]) {
    return Promise.all(
      chunk.map(nsInfo => {
        return API.getNamespaceTls(nsInfo.name).then(rs => ({ status: rs.data, nsInfo: nsInfo }));
      })
    )
      .then(results => {
        results.forEach(result => {
          result.nsInfo.tlsStatus = {
            status: nsWideMTLSStatus(result.status.status, this.props.meshStatus)
          };
        });
      })
      .catch(err => this.handleAxiosError('Could not fetch TLS status', err));
  }

  fetchValidations(isAscending: boolean, sortField: SortField<NamespaceInfo>) {
    _.chunk(this.state.namespaces, 10).forEach(chunk => {
      this.promises
        .registerChained('validationchunks', undefined, () => this.fetchValidationChunk(chunk))
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
  }

  fetchValidationChunk(chunk: NamespaceInfo[]) {
    return Promise.all(
      chunk.map(nsInfo => {
        return Promise.all([
          API.getNamespaceValidations(nsInfo.name),
          API.getIstioConfig(nsInfo.name, ['authorizationpolicies'], false, '', '')
        ]).then(results => {
          return { validations: results[0].data, istioConfig: results[1].data, nsInfo: nsInfo };
        });
      })
    )
      .then(results => {
        results.forEach(result => {
          result.nsInfo.validations = result.validations;
          result.nsInfo.istioConfig = result.istioConfig;
        });
      })
      .catch(err => this.handleAxiosError('Could not fetch validations status', err));
  }

  fetchPermissions() {
    this.promises
      .register('namespacepermissions', API.getIstioPermissions(this.state.namespaces.map(ns => ns.name)))
      .then(result => {
        this.setState({
          permissions: result.data
        });
      });
  }

  handleAxiosError(message: string, error: AxiosError) {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  }

  sort = (sortField: SortField<NamespaceInfo>, isAscending: boolean) => {
    const sorted = Sorts.sortFunc(this.state.namespaces, sortField, isAscending);
    this.setState({ namespaces: sorted });
  };

  setDisplayMode = (mode: OverviewDisplayMode) => {
    this.setState({ displayMode: mode });
    HistoryManager.setParam(URLParam.DISPLAY_MODE, String(mode));
    if (mode === OverviewDisplayMode.EXPAND) {
      // Load metrics
      this.fetchMetrics();
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

  show = (showType: Show, namespace: string, graphType: string) => {
    let destination = '';
    switch (showType) {
      case Show.GRAPH:
        destination = `/graph/namespaces?namespaces=${namespace}&graphType=${graphType}`;
        break;
      case Show.APPLICATIONS:
        destination = `/${Paths.APPLICATIONS}?namespaces=` + namespace;
        break;
      case Show.WORKLOADS:
        destination = `/${Paths.WORKLOADS}?namespaces=` + namespace;
        break;
      case Show.SERVICES:
        destination = `/${Paths.SERVICES}?namespaces=` + namespace;
        break;
      case Show.ISTIO_CONFIG:
        destination = `/${Paths.ISTIO}?namespaces=` + namespace;
        break;
      default:
      // Nothing to do on default case
    }
    history.push(destination);
  };

  getNamespaceActions = (nsInfo: NamespaceInfo): OverviewNamespaceAction[] => {
    // Today actions are fixed, but soon actions may depend of the state of a namespace
    // So we keep this wrapped in a showActions function.
    const namespaceActions: OverviewNamespaceAction[] = [
      {
        isGroup: true,
        isSeparator: false,
        isDisabled: false,
        title: 'Show',
        children: [
          {
            isGroup: true,
            isSeparator: false,
            isDisabled: false,
            title: 'Graph',
            action: (ns: string) => this.show(Show.GRAPH, ns, this.state.type)
          },
          {
            isGroup: true,
            isSeparator: false,
            isDisabled: false,
            title: 'Applications',
            action: (ns: string) => this.show(Show.APPLICATIONS, ns, this.state.type)
          },
          {
            isGroup: true,
            isSeparator: false,
            isDisabled: false,
            title: 'Workloads',
            action: (ns: string) => this.show(Show.WORKLOADS, ns, this.state.type)
          },
          {
            isGroup: true,
            isSeparator: false,
            isDisabled: false,
            title: 'Services',
            action: (ns: string) => this.show(Show.SERVICES, ns, this.state.type)
          },
          {
            isGroup: true,
            isSeparator: false,
            isDisabled: false,
            title: 'Istio Config',
            action: (ns: string) => this.show(Show.ISTIO_CONFIG, ns, this.state.type)
          }
        ]
      }
    ];
    // We are going to assume that if the user can create/update Istio AuthorizationPolicies in a namespace
    // then it can use the Istio Injection Actions.
    // RBAC allow more fine granularity but Kiali won't check that in detail.
    let canWrite = false;
    if (
      this.state.permissions &&
      this.state.permissions[nsInfo.name] &&
      this.state.permissions[nsInfo.name][AUTHORIZATION_POLICIES]
    ) {
      const resourcePermission = this.state.permissions[nsInfo.name][AUTHORIZATION_POLICIES];
      canWrite = resourcePermission.create && resourcePermission.update && resourcePermission.delete;
    }

    if (serverConfig.kialiFeatureFlags.istioInjectionAction) {
      namespaceActions.push({
        isGroup: false,
        isSeparator: true,
        isDisabled: false
      });
      const enableAction = {
        isGroup: false,
        isSeparator: false,
        isDisabled: !canWrite,
        title: 'Enable Auto Injection',
        action: (ns: string) => this.onAddRemoveAutoInjection(ns, true, false)
      };
      const disableAction = {
        isGroup: false,
        isSeparator: false,
        isDisabled: !canWrite,
        title: 'Disable Auto Injection',
        action: (ns: string) => this.onAddRemoveAutoInjection(ns, false, false)
      };
      const removeAction = {
        isGroup: false,
        isSeparator: false,
        isDisabled: !canWrite,
        title: 'Remove Auto Injection',
        action: (ns: string) => this.onAddRemoveAutoInjection(ns, false, true)
      };
      if (
        nsInfo.labels &&
        nsInfo.labels[serverConfig.istioLabels.injectionLabelName] &&
        nsInfo.labels[serverConfig.istioLabels.injectionLabelName] === 'enabled'
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
    namespaceActions.push({
      isGroup: false,
      isSeparator: true,
      isDisabled: false
    });
    const aps = nsInfo.istioConfig?.authorizationPolicies || [];
    const addAuthorizationAction = {
      isGroup: false,
      isSeparator: false,
      isDisabled: !canWrite,
      title: (aps.length === 0 ? 'Create ' : 'Update') + ' Traffic Policies',
      action: (ns: string) => {
        if (aps.length === 0) {
          this.onCreateTrafficPolicies(ns);
        } else {
          this.onUpdateTrafficPolicies(ns);
        }
      }
    };
    const removeAuthorizationAction = {
      isGroup: false,
      isSeparator: false,
      isDisabled: !canWrite,
      title: 'Delete Traffic Policies',
      action: (ns: string) => this.onDeleteTrafficPolicies(ns)
    };
    namespaceActions.push(addAuthorizationAction);
    if (aps.length > 0) {
      namespaceActions.push(removeAuthorizationAction);
    }
    return namespaceActions;
  };

  onAddRemoveAutoInjection = (ns: string, enable: boolean, remove: boolean): void => {
    const jsonPatch = buildNamespaceInjectionPatch(enable, remove);
    API.updateNamespace(ns, jsonPatch)
      .then(_ => {
        AlertUtils.add('Namespace ' + ns + ' updated', 'default', MessageType.SUCCESS);
        this.load();
      })
      .catch(error => {
        AlertUtils.addError('Could not update namespace ' + ns, error);
      });
  };

  onCreateTrafficPolicies = (ns: string) => {
    this.onAddRemoveAuthorizationPolicy(ns, [], false);
  };

  onUpdateTrafficPolicies = (ns: string) => {
    this.setState({
      showConfirmModal: true,
      nsTarget: ns,
      opTarget: 'update'
    });
  };

  onDeleteTrafficPolicies = (ns: string) => {
    this.setState({
      showConfirmModal: true,
      nsTarget: ns,
      opTarget: 'delete'
    });
  };

  onAddRemoveAuthorizationPolicy = (
    ns: string,
    authorizationPolicies: AuthorizationPolicy[],
    remove: boolean
  ): void => {
    if (authorizationPolicies.length > 0) {
      this.promises
        .registerAll(
          'authorizationPoliciesDelete',
          authorizationPolicies.map(ap => API.deleteIstioConfigDetail(ns, 'authorizationpolicies', ap.metadata.name))
        )
        .then(_ => {
          if (!remove) {
            this.createAuthorizationPolicies(ns, this.load);
          } else {
            this.load();
          }
        })
        .catch(errorDelete => {
          if (!errorDelete.isCanceled) {
            AlertUtils.addError('Could not delete AuthorizationPolicies.', errorDelete);
          }
        });
    } else {
      if (!remove) {
        this.createAuthorizationPolicies(ns, this.load);
      } else {
        AlertUtils.addInfo('Namespace ' + ns + " doesn't have AuthorizationPolicy config.");
      }
    }
  };

  createAuthorizationPolicies = (ns: string, callback: () => void) => {
    const graphDataSource = new GraphDataSource();
    graphDataSource.on('fetchSuccess', () => {
      const aps = buildGraphAuthorizationPolicy(ns, graphDataSource.graphDefinition);
      this.promises
        .registerAll(
          'authorizationPoliciesCreate',
          aps.map(ap => API.createIstioConfigDetail(ns, 'authorizationpolicies', JSON.stringify(ap)))
        )
        .then(results => {
          if (results.length > 0) {
            AlertUtils.add('AuthorizationPolicies created for ' + ns + ' namespace.', 'default', MessageType.SUCCESS);
          }
          callback();
        })
        .catch(errorCreate => {
          if (!errorCreate.isCanceled) {
            AlertUtils.addError('Could not create AuthorizationPolicies.', errorCreate);
          }
        });
    });
    graphDataSource.on('fetchError', (errorMessage: string | null) => {
      if (errorMessage !== '') {
        errorMessage = 'Could not fetch traffic data: ' + errorMessage;
      } else {
        errorMessage = 'Could not fetch traffic data.';
      }
      AlertUtils.addError(errorMessage);
    });
    graphDataSource.fetchForNamespace(this.props.duration, ns);
  };

  hideConfirmModal = () => {
    this.setState({
      showConfirmModal: false,
      nsTarget: '',
      opTarget: ''
    });
  };

  onConfirmModal = () => {
    let aps: AuthorizationPolicy[] = [];
    for (let i = 0; i < this.state.namespaces.length; i++) {
      const nsInfo = this.state.namespaces[i];
      if (this.state.namespaces[i].name === this.state.nsTarget) {
        aps = nsInfo.istioConfig?.authorizationPolicies || [];
        break;
      }
    }
    const nsTarget = this.state.nsTarget;
    const remove = this.state.opTarget === 'delete';
    this.setState(
      {
        showConfirmModal: false,
        nsTarget: '',
        opTarget: ''
      },
      () => this.onAddRemoveAuthorizationPolicy(nsTarget, aps, remove)
    );
  };

  render() {
    const sm = this.state.displayMode === OverviewDisplayMode.COMPACT ? 3 : 6;
    const md = this.state.displayMode === OverviewDisplayMode.COMPACT ? 3 : 4;
    const filteredNamespaces = FilterHelper.runFilters(
      this.state.namespaces,
      Filters.availableFilters,
      FilterSelected.getSelected()
    );
    const namespaceActions = filteredNamespaces.map((ns, i) => {
      const actions = this.getNamespaceActions(ns);
      return <OverviewNamespaceActions key={'namespaceAction_' + i} namespace={ns.name} actions={actions} />;
    });
    const modalAction =
      this.state.opTarget.length > 0
        ? this.state.opTarget.charAt(0).toLocaleUpperCase() + this.state.opTarget.slice(1)
        : '';
    return (
      <>
        <OverviewToolbarContainer
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
              />
            ) : (
              <Grid>
                {filteredNamespaces.map((ns, i) => {
                  const isLongNs = ns.name.length > NS_LONG;
                  return (
                    <GridItem sm={sm} md={md} key={'CardItem_' + ns.name} style={{ margin: '0px 5px 0 5px' }}>
                      <Card isCompact={true} className={cardGridStyle}>
                        <CardHead>
                          <CardActions>{namespaceActions[i]}</CardActions>
                          <CardHeader className={cardHeaderStyle}>
                            <Title headingLevel="h5" size="lg">
                              <span
                                className={isLongNs ? cardNamespaceNameLongStyle : cardNamespaceNameNormalStyle}
                                title={ns.name}
                              >
                                {ns.name}
                              </span>
                            </Title>
                          </CardHeader>
                        </CardHead>
                        <CardBody>
                          {this.renderLabels(ns)}
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'inline-block', width: '125px' }}>Istio Config</div>
                            {ns.tlsStatus && (
                              <span>
                                <NamespaceMTLSStatusContainer status={ns.tlsStatus.status} />
                              </span>
                            )}
                            {this.renderIstioConfigStatus(ns)}
                          </div>
                          {this.renderStatuses(ns)}
                        </CardBody>
                      </Card>
                    </GridItem>
                  );
                })}
              </Grid>
            )}
          </RenderComponentScroll>
        ) : (
          <div style={{ backgroundColor: '#f5f5f5' }}>
            <EmptyState className={emptyStateStyle} variant={EmptyStateVariant.full}>
              <Title headingLevel="h5" size="lg" style={{ marginTop: '50px' }}>
                No unfiltered namespaces
              </Title>
              <EmptyStateBody>
                Either all namespaces are being filtered or the user has no permission to access namespaces.
              </EmptyStateBody>
            </EmptyState>
          </div>
        )}
        <Modal
          isSmall={true}
          title={'Confirm ' + modalAction + ' Traffic Policies ?'}
          isOpen={this.state.showConfirmModal}
          onClose={this.hideConfirmModal}
          actions={[
            <Button key="cancel" variant="secondary" onClick={this.hideConfirmModal}>
              Cancel
            </Button>,
            <Button key="confirm" variant="danger" onClick={this.onConfirmModal}>
              {modalAction}
            </Button>
          ]}
        >
          {'Namespace ' +
            this.state.nsTarget +
            ' has existing AuthorizationPolicy objects. Do you want to ' +
            this.state.opTarget +
            ' them ?'}
        </Modal>
      </>
    );
  }

  renderLabels(ns: NamespaceInfo): JSX.Element {
    const labelsLength = ns.labels ? `${Object.entries(ns.labels).length}` : 'No';
    const labelContent = ns.labels ? (
      <div
        style={{ color: PfColors.Blue400, textAlign: 'left', cursor: 'pointer' }}
        onClick={() => this.setDisplayMode(OverviewDisplayMode.LIST)}
      >
        <Tooltip
          aria-label={'Labels list'}
          position={TooltipPosition.right}
          enableFlip={true}
          distance={5}
          content={
            <ul>
              {Object.entries(ns.labels || []).map(([key, value]) => (
                <li key={key}>
                  {key}: {value}
                </li>
              ))}
            </ul>
          }
        >
          <div id="labels_info" style={{ display: 'inline' }}>
            {labelsLength} Label{labelsLength !== '1' ? 's' : ''}
          </div>
        </Tooltip>
      </div>
    ) : (
      <div style={{ textAlign: 'left' }}>No labels</div>
    );
    return labelContent;
  }

  renderStatuses(ns: NamespaceInfo): JSX.Element {
    if (ns.status) {
      if (this.state.displayMode === OverviewDisplayMode.COMPACT) {
        return <OverviewCardContentCompact key={ns.name} name={ns.name} status={ns.status} type={this.state.type} />;
      }
      return (
        <OverviewCardContentExpanded
          key={ns.name}
          name={ns.name}
          duration={FilterHelper.currentDuration()}
          status={ns.status}
          type={this.state.type}
          metrics={ns.metrics}
        />
      );
    }
    return <div style={{ height: 70 }} />;
  }

  renderIstioConfigStatus(ns: NamespaceInfo): JSX.Element {
    let status: any = <div style={{ marginLeft: '5px' }}>N/A</div>;
    if (ns.validations) {
      const summary = (
        <ValidationSummary
          id={'ns-val-' + ns.name}
          errors={ns.validations.errors}
          warnings={ns.validations.warnings}
          objectCount={ns.validations.objectCount}
        />
      );
      status =
        ns.validations.objectCount && ns.validations.objectCount > 0 ? (
          <Link to={`/${Paths.ISTIO}?namespaces=${ns.name}`}>{summary}</Link>
        ) : (
          summary
        );
    }
    return status;
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  meshStatus: meshWideMTLSStatusSelector(state),
  navCollapse: state.userSettings.interface.navCollapse,
  refreshInterval: refreshIntervalSelector(state)
});

const OverviewPageContainer = connect(mapStateToProps)(OverviewPage);
export default OverviewPageContainer;
