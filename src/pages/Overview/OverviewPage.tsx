import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  AggregateStatusNotification,
  AggregateStatusNotifications,
  Breadcrumb,
  Card,
  CardBody,
  CardGrid,
  CardTitle,
  Col,
  Icon,
  Row
} from 'patternfly-react';
import { style } from 'typestyle';
import { AxiosError } from 'axios';

import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
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
import Namespace from '../../types/Namespace';
import { authentication } from '../../utils/Authentication';

import { FiltersAndSorts } from './FiltersAndSorts';
import OverviewStatus from './OverviewStatus';
import OverviewToolbarContainer, { OverviewToolbar, OverviewType } from './OverviewToolbar';
import NamespaceInfo from './NamespaceInfo';
import { ListPageLink, TargetPage } from '../../components/ListPage/ListPageLink';
import { SortField } from '../../types/SortFilters';

type State = {
  namespaces: NamespaceInfo[];
  type: OverviewType;
};

interface OverviewProps {}
const cardGridStyle = style({
  width: '100%'
});

class OverviewPage extends React.Component<OverviewProps, State> {
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

  private static switchType<T, U, V>(type: OverviewType, caseApp: T, caseService: U, caseWorkload: V): T | U | V {
    return type === 'app' ? caseApp : type === 'service' ? caseService : caseWorkload;
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

  sortFields() {
    return FiltersAndSorts.sortFields;
  }

  load = () => {
    API.getNamespaces(authentication())
      .then(namespacesResponse => {
        const nameFilters = FilterSelected.getSelected().filter(f => f.category === FiltersAndSorts.nameFilter.title);
        const namespaces: Namespace[] = namespacesResponse['data'].filter(ns => {
          return nameFilters.length === 0 || nameFilters.some(f => ns.name.includes(f.value));
        });
        this.fetchHealth(namespaces.map(namespace => namespace.name));
      })
      .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list', namespacesError));
  };

  fetchHealth(namespaces: string[]) {
    const rateInterval = ListPagesHelper.currentDuration();
    const isAscending = ListPagesHelper.isCurrentSortAscending();
    const sortField = ListPagesHelper.currentSortField(FiltersAndSorts.sortFields);
    const type = OverviewToolbar.currentOverviewType();
    const promises = namespaces.map(namespace => {
      const healthPromise: Promise<
        NamespaceAppHealth | NamespaceWorkloadHealth | NamespaceServiceHealth
      > = OverviewPage.switchType(
        type,
        () => API.getNamespaceAppHealth(authentication(), namespace, rateInterval),
        () => API.getNamespaceServiceHealth(authentication(), namespace, rateInterval),
        () => API.getNamespaceWorkloadHealth(authentication(), namespace, rateInterval)
      )();
      return healthPromise.then(r => ({
        namespace: namespace,
        health: r
      }));
    });
    Promise.all(promises).then(responses => {
      const allNamespaces: NamespaceInfo[] = [];
      responses.forEach(response => {
        const info: NamespaceInfo = {
          name: response.namespace,
          inError: [],
          inWarning: [],
          inSuccess: [],
          notAvailable: []
        };
        const { showInError, showInWarning, showInSuccess, noFilter } = OverviewPage.summarizeHealthFilters();
        let show = noFilter;
        Object.keys(response.health).forEach(item => {
          const health: Health = response.health[item];
          const status = health.getGlobalStatus();
          if (status === FAILURE) {
            info.inError.push(item);
            show = show || showInError;
          } else if (status === DEGRADED) {
            info.inWarning.push(item);
            show = show || showInWarning;
          } else if (status === HEALTHY) {
            info.inSuccess.push(item);
            show = show || showInSuccess;
          } else {
            info.notAvailable.push(item);
          }
        });
        if (show) {
          allNamespaces.push(info);
        }
      });

      this.setState({ type: type, namespaces: FiltersAndSorts.sortFunc(allNamespaces, sortField, isAscending) });
    });
  }

  handleAxiosError(message: string, error: AxiosError) {
    ListPagesHelper.handleError(API.getErrorMsg(message, error));
  }

  sort = (sortField: SortField<NamespaceInfo>, isAscending: boolean) => {
    const sorted = FiltersAndSorts.sortFunc(this.state.namespaces, sortField, isAscending);
    this.setState({ namespaces: sorted });
  };

  render() {
    const targetPage = OverviewPage.switchType(
      this.state.type,
      TargetPage.APPLICATIONS,
      TargetPage.SERVICES,
      TargetPage.WORKLOADS
    );
    const oneItemText = OverviewPage.switchType(this.state.type, '1 Application', '1 Service', '1 Workload');
    const pluralText = OverviewPage.switchType(this.state.type, ' Applications', ' Services', ' Workloads');
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Namespaces</Breadcrumb.Item>
        </Breadcrumb>
        <OverviewToolbarContainer onRefresh={this.load} onError={ListPagesHelper.handleError} sort={this.sort} />
        <div className="cards-pf">
          <CardGrid matchHeight={true} className={cardGridStyle}>
            <Row style={{ marginBottom: '20px', marginTop: '20px' }}>
              {this.state.namespaces.map(ns => {
                const nbItems = ns.inError.length + ns.inWarning.length + ns.inSuccess.length + ns.notAvailable.length;
                const encodedNsName = encodeURIComponent(ns.name);
                return (
                  <Col xs={6} sm={3} md={3} key={ns.name}>
                    <Card matchHeight={true} accented={true} aggregated={true}>
                      <CardTitle>
                        <Link to={`/graph/namespaces?namespaces=` + encodedNsName}>{ns.name}</Link>
                      </CardTitle>
                      <CardBody>
                        <ListPageLink target={targetPage} namespaces={[{ name: ns.name }]}>
                          {nbItems === 1 ? oneItemText : nbItems + pluralText}
                        </ListPageLink>
                        <AggregateStatusNotifications>
                          {ns.inError.length > 0 && (
                            <OverviewStatus
                              id={ns.name + '-failure'}
                              namespace={ns.name}
                              status={FAILURE}
                              items={ns.inError}
                              targetPage={targetPage}
                            />
                          )}
                          {ns.inWarning.length > 0 && (
                            <OverviewStatus
                              id={ns.name + '-degraded'}
                              namespace={ns.name}
                              status={DEGRADED}
                              items={ns.inWarning}
                              targetPage={targetPage}
                            />
                          )}
                          {ns.inSuccess.length > 0 && (
                            <OverviewStatus
                              id={ns.name + '-healthy'}
                              namespace={ns.name}
                              status={HEALTHY}
                              items={ns.inSuccess}
                              targetPage={targetPage}
                            />
                          )}
                          {nbItems === ns.notAvailable.length && (
                            <AggregateStatusNotification>N/A</AggregateStatusNotification>
                          )}
                        </AggregateStatusNotifications>
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
