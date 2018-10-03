import * as React from 'react';
import { RouteComponentProps } from 'react-router';
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
import { AxiosError } from 'axios';

import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { ListPage } from '../../components/ListPage/ListPage';
import * as API from '../../services/Api';
import { AppHealth, DEGRADED, FAILURE, HEALTHY } from '../../types/Health';
import Namespace from '../../types/Namespace';
import { authentication } from '../../utils/Authentication';

import { FiltersAndSorts } from './FiltersAndSorts';
import OverviewStatus from './OverviewStatus';
import OverviewToolbar from './OverviewToolbar';
import NamespaceInfo from './NamespaceInfo';
import { ListPageLink, TargetPage } from '../../components/ListPage/ListPageLink';
import { SortField } from '../../types/SortFilters';

type State = {
  namespaces: NamespaceInfo[];
  showEmpty: boolean;
};

class OverviewPage extends ListPage.Component<{}, State, NamespaceInfo> {
  private static summarizeHealthFilters() {
    const healthFilters = FilterSelected.getSelected().filter(f => f.category === FiltersAndSorts.healthFilter.title);
    if (healthFilters.length === 0) {
      return {
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
      showInError: showInError,
      showInWarning: showInWarning,
      showInSuccess: showInSuccess
    };
  }

  constructor(props: RouteComponentProps<{}>) {
    super(props);
    this.state = {
      namespaces: [],
      showEmpty: false
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
        this.fetchAppsHealth(namespaces.map(namespace => namespace.name));
      })
      .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list.', namespacesError));
  };

  fetchAppsHealth(namespaces: string[]) {
    const rateInterval = this.currentDuration();
    const isAscending = this.isCurrentSortAscending();
    const sortField = OverviewToolbar.findSortField(this.currentSortFieldId());
    const appsPromises = namespaces.map(namespace =>
      API.getNamespaceAppHealth(authentication(), namespace, rateInterval).then(r => ({
        namespace: namespace,
        appHealth: r
      }))
    );
    Promise.all(appsPromises).then(responses => {
      const allNamespaces: NamespaceInfo[] = [];
      responses.forEach(response => {
        const info: NamespaceInfo = {
          name: response.namespace,
          appsInError: [],
          appsInWarning: [],
          appsInSuccess: []
        };
        const { showInError, showInWarning, showInSuccess } = OverviewPage.summarizeHealthFilters();
        let show = false;
        Object.keys(response.appHealth).forEach(app => {
          const health: AppHealth = response.appHealth[app];
          const status = health.getGlobalStatus();
          if (status === FAILURE) {
            info.appsInError.push(app);
            show = show || showInError;
          } else if (status === DEGRADED) {
            info.appsInWarning.push(app);
            show = show || showInWarning;
          } else if (status === HEALTHY) {
            info.appsInSuccess.push(app);
            show = show || showInSuccess;
          }
        });
        if (show) {
          allNamespaces.push(info);
        }
      });

      this.setState({ namespaces: FiltersAndSorts.sortFunc(allNamespaces, sortField, isAscending) });
    });
  }

  handleAxiosError(message: string, error: AxiosError) {
    this.handleError(API.getErrorMsg(message, error));
  }

  sort = (sortField: SortField<NamespaceInfo>, isAscending: boolean) => {
    const sorted = FiltersAndSorts.sortFunc(this.state.namespaces, sortField, isAscending);
    this.setState({ namespaces: sorted });
  };

  render() {
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Namespaces</Breadcrumb.Item>
        </Breadcrumb>
        <OverviewToolbar onRefresh={this.load} onError={this.handleError} sort={this.sort} pageHooks={this} />
        <div className="cards-pf">
          <CardGrid matchHeight={true}>
            <Row style={{ marginBottom: '20px', marginTop: '20px' }}>
              {this.state.namespaces.map(ns => {
                const nbApps = ns.appsInError.length + ns.appsInWarning.length + ns.appsInSuccess.length;
                if (!this.state.showEmpty && nbApps === 0) {
                  return undefined;
                }
                const encodedName = encodeURIComponent(ns.name);
                return (
                  <Col xs={6} sm={3} md={3} key={ns.name}>
                    <Card matchHeight={true} accented={true} aggregated={true}>
                      <CardTitle>
                        <Link to={`/graph/namespaces/${encodedName}`}>{ns.name}</Link>
                      </CardTitle>
                      <CardBody>
                        <ListPageLink target={TargetPage.APPLICATIONS} namespace={ns.name}>
                          {nbApps === 1 && '1 Application'}
                          {nbApps !== 1 && nbApps + ' Applications'}
                        </ListPageLink>
                        <AggregateStatusNotifications>
                          {ns.appsInError.length > 0 && (
                            <OverviewStatus id={ns.name + '-failure'} status={FAILURE} items={ns.appsInError} />
                          )}
                          {ns.appsInWarning.length > 0 && (
                            <OverviewStatus id={ns.name + '-degraded'} status={DEGRADED} items={ns.appsInWarning} />
                          )}
                          {ns.appsInSuccess.length > 0 && (
                            <OverviewStatus id={ns.name + '-healthy'} status={HEALTHY} items={ns.appsInSuccess} />
                          )}
                          {nbApps === 0 && <AggregateStatusNotification>N/A</AggregateStatusNotification>}
                        </AggregateStatusNotifications>
                        <div>
                          <Link to={`/graph/namespaces/${encodedName}`} title="Graph">
                            <Icon type="pf" name="topology" style={{ paddingLeft: 10, paddingRight: 10 }} />
                          </Link>
                          <ListPageLink target={TargetPage.APPLICATIONS} namespace={ns.name} title="Applications list">
                            <Icon type="pf" name="applications" style={{ paddingLeft: 10, paddingRight: 10 }} />
                          </ListPageLink>
                          <ListPageLink target={TargetPage.WORKLOADS} namespace={ns.name} title="Workloads list">
                            <Icon type="pf" name="bundle" style={{ paddingLeft: 10, paddingRight: 10 }} />
                          </ListPageLink>
                          <ListPageLink target={TargetPage.SERVICES} namespace={ns.name} title="Services list">
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
