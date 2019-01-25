import * as React from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb, Card, CardBody, CardGrid, CardTitle, Col, Icon, Row } from 'patternfly-react';
import { style } from 'typestyle';
import { AxiosError } from 'axios';
import _ from 'lodash';

import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import { ListPageLink, TargetPage } from '../../components/ListPage/ListPageLink';
import * as API from '../../services/Api';
import {
  DEGRADED,
  FAILURE,
  HEALTHY,
  Health,
  NamespaceAppHealth,
  NamespaceServiceHealth,
  NamespaceWorkloadHealth
} from '../../types/Health';
import { SortField } from '../../types/SortFilters';
import { authentication } from '../../utils/Authentication';
import { PromisesRegistry } from '../../utils/CancelablePromises';

import { FiltersAndSorts } from './FiltersAndSorts';
import OverviewToolbarContainer, { OverviewToolbar, OverviewType } from './OverviewToolbar';
import NamespaceInfo, { NamespaceStatus } from './NamespaceInfo';
import OverviewStatuses from './OverviewStatuses';
import { switchType } from './OverviewHelper';

type State = {
  namespaces: NamespaceInfo[];
  type: OverviewType;
};

type OverviewProps = {};

const cardGridStyle = style({
  width: '100%'
});

class OverviewPage extends React.Component<OverviewProps, State> {
  private promises = new PromisesRegistry();

  private static summarizeHealthFilters() {
    const healthFilters = FilterSelected.getSelected().filter(f => f.category === FiltersAndSorts.healthFilter.title);
    if (healthFilters.length === 0) {
      return {
        noFilter: true,
        showInError: true,
        showInWarning: true,
        showInSuccess: true
      };
    }
    let showInError = false,
      showInWarning = false,
      showInSuccess = false;
    healthFilters.forEach(f => {
      switch (f.value) {
        case FAILURE.name:
          showInError = true;
          break;
        case DEGRADED.name:
          showInWarning = true;
          break;
        case HEALTHY.name:
          showInSuccess = true;
          break;
        default:
      }
    });
    return {
      noFilter: false,
      showInError: showInError,
      showInWarning: showInWarning,
      showInSuccess: showInSuccess
    };
  }

  constructor(props: OverviewProps) {
    super(props);
    this.state = {
      namespaces: [],
      type: OverviewToolbar.currentOverviewType()
    };
  }

  componentDidMount() {
    this.load();
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  sortFields() {
    return FiltersAndSorts.sortFields;
  }

  load = () => {
    this.promises.cancelAll();
    this.promises
      .register('namespaces', API.getNamespaces(authentication()))
      .then(namespacesResponse => {
        const nameFilters = FilterSelected.getSelected().filter(f => f.category === FiltersAndSorts.nameFilter.title);
        const allNamespaces: NamespaceInfo[] = namespacesResponse['data']
          .filter(ns => {
            return nameFilters.length === 0 || nameFilters.some(f => ns.name.includes(f.value));
          })
          .map(ns => {
            const previous = this.state.namespaces.find(prev => prev.name === ns.name);
            return {
              name: ns.name,
              status: previous ? previous.status : undefined
            };
          });
        const isAscending = ListPagesHelper.isCurrentSortAscending();
        const sortField = ListPagesHelper.currentSortField(FiltersAndSorts.sortFields);
        const type = OverviewToolbar.currentOverviewType();
        // Set state before actually fetching health
        this.setState({ type: type, namespaces: FiltersAndSorts.sortFunc(allNamespaces, sortField, isAscending) }, () =>
          this.fetchHealth(isAscending, sortField, type)
        );
      })
      .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list', namespacesError));
  };

  fetchHealth(isAscending: boolean, sortField: SortField<NamespaceInfo>, type: OverviewType) {
    const rateInterval = ListPagesHelper.currentDuration();
    // debounce async for back-pressure, ten by ten
    _.chunk(this.state.namespaces, 10).forEach(chunk => {
      this.promises
        .registerChained('healthchunks', undefined, () => this.fetchHealthChunk(chunk, rateInterval, type))
        .then(() => {
          this.setState(prevState => {
            let newNamespaces = prevState.namespaces.slice();
            if (sortField.id === 'health') {
              newNamespaces = FiltersAndSorts.sortFunc(newNamespaces, sortField, isAscending);
            }
            return { namespaces: newNamespaces };
          });
        });
    });
  }

  fetchHealthChunk(chunk: NamespaceInfo[], rateInterval: number, type: OverviewType) {
    const apiFunc = switchType(
      type,
      API.getNamespaceAppHealth,
      API.getNamespaceServiceHealth,
      API.getNamespaceWorkloadHealth
    );
    return Promise.all(
      chunk.map(nsInfo => {
        const healthPromise: Promise<NamespaceAppHealth | NamespaceWorkloadHealth | NamespaceServiceHealth> = apiFunc(
          authentication(),
          nsInfo.name,
          rateInterval
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

  handleAxiosError(message: string, error: AxiosError) {
    ListPagesHelper.handleError(API.getErrorMsg(message, error));
  }

  sort = (sortField: SortField<NamespaceInfo>, isAscending: boolean) => {
    const sorted = FiltersAndSorts.sortFunc(this.state.namespaces, sortField, isAscending);
    this.setState({ namespaces: sorted });
  };

  render() {
    const { showInError, showInWarning, showInSuccess, noFilter } = OverviewPage.summarizeHealthFilters();
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Namespaces</Breadcrumb.Item>
        </Breadcrumb>
        <OverviewToolbarContainer onRefresh={this.load} onError={ListPagesHelper.handleError} sort={this.sort} />
        <div className="cards-pf">
          <CardGrid matchHeight={true} className={cardGridStyle}>
            <Row style={{ marginBottom: '20px', marginTop: '20px' }}>
              {this.state.namespaces
                .filter(ns => {
                  return (
                    noFilter ||
                    (ns.status &&
                      ((showInError && ns.status.inError.length > 0) ||
                        (showInWarning && ns.status.inWarning.length > 0) ||
                        (showInSuccess && ns.status.inSuccess.length > 0)))
                  );
                })
                .map(ns => {
                  return (
                    <Col xs={6} sm={3} md={3} key={ns.name}>
                      <Card matchHeight={true} accented={true} aggregated={true}>
                        <CardTitle>{ns.name}</CardTitle>
                        <CardBody>
                          {ns.status ? (
                            <OverviewStatuses key={ns.name} name={ns.name} status={ns.status} type={this.state.type} />
                          ) : (
                            <div style={{ height: 70 }} />
                          )}
                          <div>
                            <Link to={`/graph/namespaces?namespaces=` + ns.name} title="Graph">
                              <Icon type="pf" name="topology" style={{ paddingLeft: 10, paddingRight: 10 }} />
                            </Link>
                            <ListPageLink
                              target={TargetPage.APPLICATIONS}
                              namespaces={[{ name: ns.name }]}
                              title="Applications list"
                            >
                              <Icon type="pf" name="applications" style={{ paddingLeft: 10, paddingRight: 10 }} />
                            </ListPageLink>
                            <ListPageLink
                              target={TargetPage.WORKLOADS}
                              namespaces={[{ name: ns.name }]}
                              title="Workloads list"
                            >
                              <Icon type="pf" name="bundle" style={{ paddingLeft: 10, paddingRight: 10 }} />
                            </ListPageLink>
                            <ListPageLink
                              target={TargetPage.SERVICES}
                              namespaces={[{ name: ns.name }]}
                              title="Services list"
                            >
                              <Icon type="pf" name="service" style={{ paddingLeft: 10, paddingRight: 10 }} />
                            </ListPageLink>
                          </div>
                        </CardBody>
                      </Card>
                    </Col>
                  );
                })}
            </Row>
          </CardGrid>
        </div>
      </>
    );
  }
}

export default OverviewPage;
