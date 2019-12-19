import * as React from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Grid,
  GridItem,
  Text,
  TextVariants,
  Title
} from '@patternfly/react-core';
import { style } from 'typestyle';
import { AxiosError } from 'axios';
import _ from 'lodash';

import { FilterSelected } from '../../components/Filters/StatefulFilters';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import * as API from '../../services/Api';
import {
  DEGRADED,
  FAILURE,
  Health,
  HEALTHY,
  NamespaceAppHealth,
  NamespaceServiceHealth,
  NamespaceWorkloadHealth
} from '../../types/Health';
import { SortField } from '../../types/SortFilters';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import OverviewToolbarContainer, { OverviewDisplayMode, OverviewToolbar, OverviewType } from './OverviewToolbar';
import NamespaceInfo, { NamespaceStatus } from './NamespaceInfo';
import NamespaceMTLSStatusContainer from '../../components/MTls/NamespaceMTLSStatus';
import { RenderHeader } from '../../components/Nav/Page';
import OverviewCardContentCompact from './OverviewCardContentCompact';
import OverviewCardContentExpanded from './OverviewCardContentExpanded';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { computePrometheusRateParams } from '../../services/Prometheus';
import OverviewCardLinks from './OverviewCardLinks';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { meshWideMTLSStatusSelector, durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { nsWideMTLSStatus } from '../../types/TLSStatus';
import { switchType } from './OverviewHelper';
import * as Sorts from './Sorts';
import * as Filters from './Filters';
import ValidationSummary from '../../components/Validations/ValidationSummary';
import { DurationInSeconds, RefreshIntervalInMs } from 'types/Common';
import { Link } from 'react-router-dom';
import { Paths } from '../../config';

const gridStyle = style({ backgroundColor: '#f5f5f5', paddingBottom: '20px', marginTop: '20px' });
const cardGridStyle = style({ borderTop: '2px solid #39a5dc', textAlign: 'center', marginTop: '20px' });

const emptyStateStyle = style({
  height: '300px',
  marginRight: 5,
  marginBottom: 10,
  marginTop: 10
});

type State = {
  namespaces: NamespaceInfo[];
  type: OverviewType;
  displayMode: OverviewDisplayMode;
};

type ReduxProps = {
  duration: DurationInSeconds;
  meshStatus: string;
  navCollapse: boolean;
  refreshInterval: RefreshIntervalInMs;
};

type OverviewProps = ReduxProps & {};

export class OverviewPage extends React.Component<OverviewProps, State> {
  private promises = new PromisesRegistry();
  private displayModeSet = false;

  constructor(props: OverviewProps) {
    super(props);
    this.state = {
      namespaces: [],
      type: OverviewToolbar.currentOverviewType(),
      displayMode: OverviewDisplayMode.EXPAND
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

  load = () => {
    this.promises.cancelAll();
    this.promises
      .register('namespaces', API.getNamespaces())
      .then(namespacesResponse => {
        const nameFilters = FilterSelected.getSelected().filter(f => f.category === Filters.nameFilter.title);
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
              validations: previous ? previous.validations : undefined
            };
          });
        const isAscending = FilterHelper.isCurrentSortAscending();
        const sortField = FilterHelper.currentSortField(Sorts.sortFields);
        const type = OverviewToolbar.currentOverviewType();
        const displayMode = this.displayModeSet
          ? this.state.displayMode
          : allNamespaces.length > 16
          ? OverviewDisplayMode.COMPACT
          : OverviewDisplayMode.EXPAND;
        // Set state before actually fetching health
        this.setState(
          {
            type: type,
            namespaces: Sorts.sortFunc(allNamespaces, sortField, isAscending),
            displayMode: displayMode
          },
          () => {
            this.fetchHealth(isAscending, sortField, type);
            this.fetchTLS(isAscending, sortField);
            this.fetchValidations(isAscending, sortField);
            if (displayMode === OverviewDisplayMode.EXPAND) {
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
          nsInfo.metrics = undefined;
          if (rs.data.metrics.hasOwnProperty('request_count')) {
            nsInfo.metrics = rs.data.metrics.request_count.matrix;
          }
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
        return API.getNamespaceValidations(nsInfo.name).then(rs => ({ validations: rs.data, nsInfo: nsInfo }));
      })
    )
      .then(results => {
        results.forEach(result => {
          result.nsInfo.validations = result.validations;
        });
      })
      .catch(err => this.handleAxiosError('Could not fetch validations status', err));
  }

  handleAxiosError(message: string, error: AxiosError) {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  }

  sort = (sortField: SortField<NamespaceInfo>, isAscending: boolean) => {
    const sorted = Sorts.sortFunc(this.state.namespaces, sortField, isAscending);
    this.setState({ namespaces: sorted });
  };

  setDisplayMode = (mode: OverviewDisplayMode) => {
    this.displayModeSet = true;
    this.setState({ displayMode: mode });
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

  render() {
    const sm = this.state.displayMode === OverviewDisplayMode.COMPACT ? 3 : 6;
    const md = this.state.displayMode === OverviewDisplayMode.COMPACT ? 3 : 4;
    const filteredNamespaces = Filters.filterBy(this.state.namespaces, FilterSelected.getSelected());
    return (
      <>
        <RenderHeader>
          <Breadcrumb style={{ marginTop: '10px' }}>
            <BreadcrumbItem isActive={true}>Namespaces</BreadcrumbItem>
          </Breadcrumb>
          <OverviewToolbarContainer
            onRefresh={this.load}
            onError={FilterHelper.handleError}
            sort={this.sort}
            displayMode={this.state.displayMode}
            setDisplayMode={this.setDisplayMode}
          />
        </RenderHeader>
        {filteredNamespaces.length > 0 ? (
          <Grid className={gridStyle}>
            {filteredNamespaces.map(ns => (
              <GridItem sm={sm} md={md} key={'CardItem_' + ns.name} style={{ margin: '0px 10px 0 10px' }}>
                <Card isCompact={true} className={cardGridStyle}>
                  <CardHeader>
                    {ns.tlsStatus ? <NamespaceMTLSStatusContainer status={ns.tlsStatus.status} /> : undefined}
                    {ns.name}
                  </CardHeader>
                  <CardBody>
                    {this.renderStatuses(ns)}
                    {this.renderIstioConfigStatus(ns)}
                    <OverviewCardLinks name={ns.name} overviewType={OverviewToolbar.currentOverviewType()} />
                  </CardBody>
                </Card>
              </GridItem>
            ))}
          </Grid>
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
      </>
    );
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
    let status: any = 'N/A';
    if (ns.validations && !this.isNamespaceEmpty(ns)) {
      status = (
        <Link to={`/${Paths.ISTIO}?namespaces=${ns.name}`}>
          <ValidationSummary
            id={'ns-val-' + ns.name}
            errors={ns.validations.errors}
            warnings={ns.validations.warnings}
            style={{ marginLeft: '5px' }}
          />
        </Link>
      );
    }
    return (
      <>
        <Text component={TextVariants.p}>Istio Config status: {status}</Text>
      </>
    );
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
