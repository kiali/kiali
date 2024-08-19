import * as React from 'react';
import {
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardHeaderMain,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Grid,
  GridItem,
  Label,
  Title,
  TitleSizes,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { style } from 'typestyle';
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
import OverviewToolbarContainer, {
  OverviewDisplayMode,
  OverviewToolbar,
  OverviewType,
  DirectionType
} from './OverviewToolbar';
import NamespaceInfo, { NamespaceStatus } from './NamespaceInfo';
import NamespaceMTLSStatusContainer from '../../components/MTls/NamespaceMTLSStatus';
import { RenderComponentScroll } from '../../components/Nav/Page';
import NamespaceStatuses from './NamespaceStatuses';
import OverviewCardSparklineCharts from './OverviewCardSparklineCharts';
import OverviewTrafficPolicies from './OverviewTrafficPolicies';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { computePrometheusRateParams } from '../../services/Prometheus';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import {
  durationSelector,
  meshWideMTLSStatusSelector,
  minTLSVersionSelector,
  refreshIntervalSelector
} from '../../store/Selectors';
import { nsWideMTLSStatus } from '../../types/TLSStatus';
import { switchType } from './OverviewHelper';
import * as Sorts from './Sorts';
import * as Filters from './Filters';
import ValidationSummary from '../../components/Validations/ValidationSummary';
import { DurationInSeconds, IntervalInMilliseconds } from 'types/Common';
import { Paths, serverConfig } from '../../config';
import { PFColors } from '../../components/Pf/PfColors';
import VirtualList from '../../components/VirtualList/VirtualList';
import { OverviewNamespaceAction, OverviewNamespaceActions } from './OverviewNamespaceActions';
import history, { HistoryManager, URLParam } from '../../app/History';
import * as AlertUtils from '../../utils/AlertUtils';
import { MessageType } from '../../types/MessageCenter';
import { CanaryUpgradeStatus, OutboundTrafficPolicy, ValidationStatus } from '../../types/IstioObjects';
import { GrafanaInfo, ISTIO_DASHBOARDS } from '../../types/GrafanaInfo';
import { ExternalLink } from '../../types/Dashboards';
import { isParentKiosk, kioskOverviewAction } from '../../components/Kiosk/KioskActions';
import ValidationSummaryLinkContainer from '../../components/Link/ValidationSummaryLink';
import _ from 'lodash';
import ControlPlaneBadge from './ControlPlaneBadge';
import OverviewStatusContainer from './OverviewStatus';
import ControlPlaneNamespaceStatus from './ControlPlaneNamespaceStatus';
import { IstiodResourceThresholds } from 'types/IstioStatus';
import TLSInfo from 'components/Overview/TLSInfo';
import CanaryUpgradeProgress from './CanaryUpgradeProgress';
import ControlPlaneVersionBadge from './ControlPlaneVersionBadge';
import {ApiError} from "../../types/Api";

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

const cardGridStyle = style({
  textAlign: 'center',
  marginTop: '0px',
  marginBottom: '10px'
});

const cardControlPlaneGridStyle = style({
  textAlign: 'center',
  marginTop: '0px',
  marginBottom: '10px'
});

const emptyStateStyle = style({
  height: '300px',
  marginRight: 5,
  marginBottom: 10,
  marginTop: 10
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

export enum Show {
  GRAPH,
  APPLICATIONS,
  WORKLOADS,
  SERVICES,
  ISTIO_CONFIG
}

type State = {
  namespaces: NamespaceInfo[];
  type: OverviewType;
  direction: DirectionType;
  displayMode: OverviewDisplayMode;
  showTrafficPoliciesModal: boolean;
  kind: string;
  nsTarget: string;
  opTarget: string;
  grafanaLinks: ExternalLink[];
  istiodResourceThresholds: IstiodResourceThresholds;
  outboundPolicyMode: OutboundTrafficPolicy;
  canaryUpgradeStatus?: CanaryUpgradeStatus;
};

type ReduxProps = {
  duration: DurationInSeconds;
  isMaistra: boolean;
  istioAPIEnabled: boolean;
  kiosk: string;
  meshStatus: string;
  minTLS: string;
  navCollapse: boolean;
  refreshInterval: IntervalInMilliseconds;
};

type OverviewProps = ReduxProps & {};

export class OverviewPage extends React.Component<OverviewProps, State> {
  private sFOverviewToolbar: React.RefObject<StatefulFilters> = React.createRef();
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
      opTarget: '',
      grafanaLinks: [],
      istiodResourceThresholds: { memory: 0, cpu: 0 },
      outboundPolicyMode: {},
      canaryUpgradeStatus: undefined
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
    this.fetchGrafanaInfo();
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
        const nameFilters = FilterSelected.getSelected().filters.filter(
          f => f.category === Filters.nameFilter.category
        );
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
              errorMetrics: previous ? previous.errorMetrics : undefined,
              validations: previous ? previous.validations : undefined,
              labels: ns.labels,
              controlPlaneMetrics: previous ? previous.controlPlaneMetrics : undefined
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
            this.fetchOutboundTrafficPolicyMode();
            this.fetchCanariesStatus();
            this.fetchIstiodResourceThresholds();
            this.fetchValidations(isAscending, sortField);
            if (displayMode !== OverviewDisplayMode.COMPACT) {
              this.fetchMetrics(direction);
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
        })
        .catch(error => {
          if (error.isCanceled) {
            return;
          }
          this.handleAxiosError('Could not fetch health', error);
        });
    });
  }

  fetchGrafanaInfo() {
    if (!OverviewPage.grafanaInfoPromise) {
      OverviewPage.grafanaInfoPromise = API.getGrafanaInfo().then(response => {
        if (response.status === 204) {
          return undefined;
        }
        return response.data;
      });
    }
    OverviewPage.grafanaInfoPromise
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
          ...AlertUtils.extractAxiosError('Could not fetch Grafana info. Turning off links to Grafana.', err),
          group: 'default',
          type: MessageType.INFO,
          showNotification: false
        });
      });
  }

  fetchHealthChunk(chunk: NamespaceInfo[], duration: DurationInSeconds, type: OverviewType) {
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

  fetchMetrics(direction: DirectionType) {
    const duration = FilterHelper.currentDuration();
    // debounce async for back-pressure, ten by ten
    _.chunk(this.state.namespaces, 10).forEach(chunk => {
      this.promises
        .registerChained('metricschunks', undefined, () => this.fetchMetricsChunk(chunk, duration, direction))
        .then(() => {
          this.setState(prevState => {
            return { namespaces: prevState.namespaces.slice() };
          });
        });
    });
  }

  fetchMetricsChunk(chunk: NamespaceInfo[], duration: number, direction: DirectionType) {
    const rateParams = computePrometheusRateParams(duration, 10);
    const options: IstioMetricsOptions = {
      filters: ['request_count', 'request_error_count'],
      duration: duration,
      step: rateParams.step,
      rateInterval: rateParams.rateInterval,
      direction: direction,
      reporter: direction === 'inbound' ? 'destination' : 'source'
    };

    return Promise.all(
      chunk.map(nsInfo => {
        return API.getNamespaceMetrics(nsInfo.name, options).then(rs => {
          nsInfo.metrics = rs.data.request_count;
          nsInfo.errorMetrics = rs.data.request_error_count;
          if (nsInfo.name === serverConfig.istioNamespace) {
            nsInfo.controlPlaneMetrics = {
              istiod_proxy_time: rs.data.pilot_proxy_convergence_time,
              istiod_cpu: rs.data.process_cpu_seconds_total,
              istiod_mem: rs.data.process_virtual_memory_bytes
            };
          }
          return nsInfo;
        });
      })
    ).catch(err => this.handleAxiosError('Could not fetch metrics', err));
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
            status: nsWideMTLSStatus(result.status.status, this.props.meshStatus),
            autoMTLSEnabled: result.status.autoMTLSEnabled,
            minTLS: result.status.minTLS
          };
        });
      })
      .catch(err => this.handleAxiosError('Could not fetch TLS status', err));
  }

  fetchValidations(isAscending: boolean, sortField: SortField<NamespaceInfo>) {
    _.chunk(this.state.namespaces, 10).forEach(chunk => {
      this.promises
        .registerChained('validation', undefined, () => this.fetchValidationResult(chunk))
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

  fetchValidationResult(chunk: NamespaceInfo[]) {
    const nss: string[] = [];
    chunk.forEach(ns => {
      nss.push(ns.name);
    });

    return Promise.all([API.getConfigValidations(nss), API.getAllIstioConfigs(nss, [], false, '', '')])
      .then(results => {
        chunk.forEach(nsInfo => {
          nsInfo.validations = results[0].data[nsInfo.name];
          nsInfo.istioConfig = results[1].data[nsInfo.name];
        });
      })
      .catch(err => this.handleAxiosError('Could not fetch validations status', err));
  }

  fetchOutboundTrafficPolicyMode() {
    API.getOutboundTrafficPolicyMode()
      .then(response => {
        this.setState({ outboundPolicyMode: { mode: response.data.mode } });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching Mesh OutboundTrafficPolicy.Mode.', error, 'default', MessageType.ERROR);
      });
  }

  fetchCanariesStatus() {
    API.getCanaryUpgradeStatus()
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
        AlertUtils.addError('Error fetching canary upgrade status.', error, 'default', MessageType.ERROR);
      });
  }

  fetchIstiodResourceThresholds() {
    API.getIstiodResourceThresholds()
      .then(response => {
        this.setState({ istiodResourceThresholds: response.data });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching Istiod resource thresholds.', error, 'default', MessageType.ERROR);
      });
  }

  handleAxiosError(message: string, error: ApiError) {
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
        !this.props.isMaistra &&
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
            this.setState({ showTrafficPoliciesModal: true, nsTarget: ns, opTarget: 'enable', kind: 'injection' })
        };
        const disableAction = {
          'data-test': `disable-${nsInfo.name}-namespace-sidecar-injection`,
          isGroup: false,
          isSeparator: false,
          title: 'Disable Auto Injection',
          action: (ns: string) =>
            this.setState({ showTrafficPoliciesModal: true, nsTarget: ns, opTarget: 'disable', kind: 'injection' })
        };
        const removeAction = {
          'data-test': `remove-${nsInfo.name}-namespace-sidecar-injection`,
          isGroup: false,
          isSeparator: false,
          title: 'Remove Auto Injection',
          action: (ns: string) =>
            this.setState({ showTrafficPoliciesModal: true, nsTarget: ns, opTarget: 'remove', kind: 'injection' })
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
          title: 'Upgrade to ' + serverConfig.istioCanaryRevision.upgrade + ' revision',
          action: (ns: string) =>
            this.setState({ opTarget: 'upgrade', kind: 'canary', nsTarget: ns, showTrafficPoliciesModal: true })
        };
        const downgradeAction = {
          isGroup: false,
          isSeparator: false,
          title: 'Downgrade to ' + serverConfig.istioCanaryRevision.current + ' revision',
          action: (ns: string) =>
            this.setState({ opTarget: 'current', kind: 'canary', nsTarget: ns, showTrafficPoliciesModal: true })
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

      const aps = nsInfo.istioConfig?.authorizationPolicies || [];
      const addAuthorizationAction = {
        isGroup: false,
        isSeparator: false,
        title: (aps.length === 0 ? 'Create ' : 'Update') + ' Traffic Policies',
        action: (ns: string) => {
          this.setState({
            opTarget: aps.length === 0 ? 'create' : 'update',
            nsTarget: ns,
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
          this.setState({ opTarget: 'delete', nsTarget: ns, showTrafficPoliciesModal: true, kind: 'policy' })
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

  hideTrafficManagement = () => {
    this.setState({
      showTrafficPoliciesModal: false,
      nsTarget: '',
      opTarget: '',
      kind: ''
    });
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

  render() {
    const sm = this.state.displayMode === OverviewDisplayMode.COMPACT ? 3 : 6;
    const md = this.state.displayMode === OverviewDisplayMode.COMPACT ? 3 : 4;
    const lg = 12;
    const filteredNamespaces = FilterHelper.runFilters(
      this.state.namespaces,
      Filters.availableFilters,
      FilterSelected.getSelected()
    );
    const namespaceActions = filteredNamespaces.map((ns, i) => {
      const actions = this.getNamespaceActions(ns);
      return <OverviewNamespaceActions key={'namespaceAction_' + i} namespace={ns.name} actions={actions} />;
    });

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
                    <GridItem
                      sm={
                        ns.name === serverConfig.istioNamespace &&
                        this.state.displayMode === OverviewDisplayMode.EXPAND &&
                        (this.props.istioAPIEnabled || this.hasCanaryUpgradeConfigured())
                          ? lg
                          : sm
                      }
                      md={
                        ns.name === serverConfig.istioNamespace &&
                        this.state.displayMode === OverviewDisplayMode.EXPAND &&
                        (this.props.istioAPIEnabled || this.hasCanaryUpgradeConfigured())
                          ? lg
                          : md
                      }
                      key={'CardItem_' + ns.name}
                      style={{ margin: '0px 5px 0 5px' }}
                    >
                      <Card
                        isCompact={true}
                        className={ns.name === serverConfig.istioNamespace ? cardControlPlaneGridStyle : cardGridStyle}
                        data-test={ns.name + '-' + OverviewDisplayMode[this.state.displayMode]}
                        style={
                          !this.props.istioAPIEnabled && !this.hasCanaryUpgradeConfigured() ? { height: '96%' } : {}
                        }
                      >
                        <CardHeader>
                          <CardHeaderMain>
                            <Title headingLevel="h5" size={TitleSizes.lg}>
                              <span
                                className={isLongNs ? cardNamespaceNameLongStyle : cardNamespaceNameNormalStyle}
                                title={ns.name}
                              >
                                {ns.name}
                                {ns.name === serverConfig.istioNamespace && <ControlPlaneBadge></ControlPlaneBadge>}
                                {ns.name !== serverConfig.istioNamespace &&
                                  this.hasCanaryUpgradeConfigured() &&
                                  this.state.canaryUpgradeStatus?.migratedNamespaces.includes(ns.name) && (
                                    <ControlPlaneVersionBadge
                                      version={this.state.canaryUpgradeStatus.upgradeVersion}
                                      isCanary={true}
                                    ></ControlPlaneVersionBadge>
                                  )}
                                {ns.name !== serverConfig.istioNamespace &&
                                  this.hasCanaryUpgradeConfigured() &&
                                  this.state.canaryUpgradeStatus?.pendingNamespaces.includes(ns.name) && (
                                    <ControlPlaneVersionBadge
                                      version={this.state.canaryUpgradeStatus.currentVersion}
                                      isCanary={false}
                                    ></ControlPlaneVersionBadge>
                                  )}
                                {ns.name === serverConfig.istioNamespace && !this.props.istioAPIEnabled && (
                                  <Label style={{ marginLeft: 10 }} color={'orange'} isCompact>
                                    Istio API disabled
                                  </Label>
                                )}
                              </span>
                            </Title>
                          </CardHeaderMain>
                          <CardActions>{namespaceActions[i]}</CardActions>
                        </CardHeader>
                        <CardBody>
                          {ns.name === serverConfig.istioNamespace &&
                            this.state.displayMode === OverviewDisplayMode.EXPAND && (
                              <Grid>
                                <GridItem md={this.props.istioAPIEnabled || this.hasCanaryUpgradeConfigured() ? 3 : 6}>
                                  {this.renderLabels(ns)}

                                  <div style={{ textAlign: 'left' }}>
                                    <div style={{ display: 'inline-block', width: '125px' }}>Istio config</div>
                                    {ns.tlsStatus && (
                                      <span>
                                        <NamespaceMTLSStatusContainer status={ns.tlsStatus.status} />
                                      </span>
                                    )}
                                    {this.props.istioAPIEnabled ? this.renderIstioConfigStatus(ns) : 'N/A'}
                                  </div>
                                  {ns.status && (
                                    <NamespaceStatuses
                                      key={ns.name}
                                      name={ns.name}
                                      status={ns.status}
                                      type={this.state.type}
                                    />
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
                                        <GridItem md={this.hasCanaryUpgradeConfigured() ? 8 : 12}>
                                          {this.renderCharts(ns)}
                                        </GridItem>
                                      )}
                                    </Grid>
                                  </GridItem>
                                )}
                              </Grid>
                            )}
                          {((ns.name !== serverConfig.istioNamespace &&
                            this.state.displayMode === OverviewDisplayMode.EXPAND) ||
                            this.state.displayMode === OverviewDisplayMode.COMPACT) && (
                            <div>
                              {this.renderLabels(ns)}

                              <div style={{ textAlign: 'left' }}>
                                <div style={{ display: 'inline-block', width: '125px' }}>Istio config</div>
                                {ns.tlsStatus && (
                                  <span>
                                    <NamespaceMTLSStatusContainer status={ns.tlsStatus.status} />
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
                    </GridItem>
                  );
                })}
              </Grid>
            )}
          </RenderComponentScroll>
        ) : (
          <div style={{ backgroundColor: '#f5f5f5' }}>
            <EmptyState className={emptyStateStyle} variant={EmptyStateVariant.full}>
              <Title headingLevel="h5" size={TitleSizes.lg} style={{ marginTop: '50px' }}>
                No unfiltered namespaces
              </Title>
              <EmptyStateBody>
                Either all namespaces are being filtered or the user has no permission to access namespaces.
              </EmptyStateBody>
            </EmptyState>
          </div>
        )}
        <OverviewTrafficPolicies
          opTarget={this.state.opTarget}
          isOpen={this.state.showTrafficPoliciesModal}
          kind={this.state.kind}
          hideConfirmModal={this.hideTrafficManagement}
          nsTarget={this.state.nsTarget}
          nsInfo={this.state.namespaces.filter(ns => ns.name === this.state.nsTarget)[0]}
          duration={this.props.duration}
          load={this.load}
        />
      </>
    );
  }

  renderLabels(ns: NamespaceInfo): JSX.Element {
    const labelsLength = ns.labels ? `${Object.entries(ns.labels).length}` : 'No';
    const labelContent = ns.labels ? (
      <div
        style={{ color: PFColors.Blue400, textAlign: 'left', cursor: 'pointer' }}
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

  renderCharts(ns: NamespaceInfo): JSX.Element {
    if (ns.status) {
      if (this.state.displayMode === OverviewDisplayMode.COMPACT) {
        return <NamespaceStatuses key={ns.name} name={ns.name} status={ns.status} type={this.state.type} />;
      }
      return (
        <OverviewCardSparklineCharts
          key={ns.name}
          name={ns.name}
          duration={FilterHelper.currentDuration()}
          direction={this.state.direction}
          metrics={ns.metrics}
          errorMetrics={ns.errorMetrics}
          controlPlaneMetrics={ns.controlPlaneMetrics}
          istiodResourceThresholds={this.state.istiodResourceThresholds}
          istioAPIEnabled={this.props.istioAPIEnabled}
        />
      );
    }
    return <div style={{ height: 70 }} />;
  }

  renderIstioConfigStatus(ns: NamespaceInfo): JSX.Element {
    let validations: ValidationStatus = { objectCount: 0, errors: 0, warnings: 0 };
    if (!!ns.validations) {
      validations = ns.validations;
    }

    return (
      <ValidationSummaryLinkContainer
        namespace={ns.name}
        objectCount={validations.objectCount}
        errors={validations.errors}
        warnings={validations.warnings}
      >
        <ValidationSummary
          id={'ns-val-' + ns.name}
          errors={validations.errors}
          warnings={validations.warnings}
          objectCount={validations.objectCount}
        />
      </ValidationSummaryLinkContainer>
    );
  }

  renderStatus(ns: NamespaceInfo): JSX.Element {
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
    if (nbItems === 1) {
      text = switchType(this.state.type, '1 application', '1 service', '1 workload');
    } else {
      text = nbItems + switchType(this.state.type, ' applications', ' services', ' workloads');
    }
    const mainLink = (
      <div
        style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}
        data-test={'overview-type-' + this.state.type}
      >
        {text}
      </div>
    );
    if (nbItems === ns.status?.notAvailable.length) {
      return (
        <div style={{ textAlign: 'left' }}>
          <span>
            {mainLink}
            <div style={{ display: 'inline-block', marginLeft: '5px' }}>N/A</div>
          </span>
        </div>
      );
    }

    return (
      <>
        <div style={{ textAlign: 'left' }}>
          <span>
            {mainLink}
            <div style={{ display: 'inline-block' }} data-test="overview-app-health">
              {ns.status && ns.status.inNotReady.length > 0 && (
                <OverviewStatusContainer
                  id={name + '-not-ready'}
                  namespace={name}
                  status={NOT_READY}
                  items={ns.status.inNotReady}
                  targetPage={targetPage}
                />
              )}
              {ns.status && ns.status.inError.length > 0 && (
                <OverviewStatusContainer
                  id={name + '-failure'}
                  namespace={name}
                  status={FAILURE}
                  items={ns.status.inError}
                  targetPage={targetPage}
                />
              )}
              {ns.status && ns.status.inWarning.length > 0 && (
                <OverviewStatusContainer
                  id={name + '-degraded'}
                  namespace={name}
                  status={DEGRADED}
                  items={ns.status.inWarning}
                  targetPage={targetPage}
                />
              )}
              {ns.status && ns.status.inSuccess.length > 0 && (
                <OverviewStatusContainer
                  id={name + '-healthy'}
                  namespace={name}
                  status={HEALTHY}
                  items={ns.status.inSuccess}
                  targetPage={targetPage}
                />
              )}
            </div>
          </span>
        </div>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  isMaistra: state.statusState.istioEnvironment.isMaistra,
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  kiosk: state.globalState.kiosk,
  meshStatus: meshWideMTLSStatusSelector(state),
  minTLS: minTLSVersionSelector(state),
  navCollapse: state.userSettings.interface.navCollapse,
  refreshInterval: refreshIntervalSelector(state)
});

const OverviewPageContainer = connect(mapStateToProps)(OverviewPage);
export default OverviewPageContainer;
