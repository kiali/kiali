import * as React from 'react';
import * as API from '../../services/Api';
import { Link, RouteComponentProps } from 'react-router-dom';
import { AppId, App } from '../../types/App';
import { authentication } from '../../utils/Authentication';
import { Breadcrumb, TabContainer, Nav, NavItem, TabContent, TabPane } from 'patternfly-react';
import AppInfo from './AppInfo';
import * as MessageCenter from '../../utils/MessageCenter';
import AppMetricsContainer from '../../containers/AppMetricsContainer';
import { AppHealth } from '../../types/Health';
import { ListPageLink, TargetPage } from '../../components/ListPage/ListPageLink';
import { MetricsObjectTypes, MetricsDirection } from '../../types/Metrics';

type AppDetailsState = {
  app: App;
  health?: AppHealth;
};
interface ParsedSearch {
  type?: string;
  name?: string;
}

class AppDetails extends React.Component<RouteComponentProps<AppId>, AppDetailsState> {
  constructor(props: RouteComponentProps<AppId>) {
    super(props);
    this.state = {
      app: {
        namespace: { name: '' },
        name: '',
        workloads: []
      }
    };
    this.fetchApp();
  }

  appPageURL(parsedSearch?: ParsedSearch) {
    return '/namespaces/' + this.props.match.params.namespace + '/applications/' + this.props.match.params.app;
  }

  fetchApp = () => {
    let promiseDetails = API.getApp(authentication(), this.props.match.params.namespace, this.props.match.params.app);

    let promiseHealth = API.getAppHealth(
      authentication(),
      this.props.match.params.namespace,
      this.props.match.params.app,
      600
    );

    Promise.all([promiseDetails, promiseHealth])
      .then(([resultDetails, resultHealth]) => {
        this.setState({
          app: resultDetails.data,
          health: resultHealth
        });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not fetch App Details.', error));
      });
  };

  renderBreadcrumbs = () => {
    const urlParams = new URLSearchParams(this.props.location.search);
    const to = this.appPageURL();
    let tab = 'Info';
    switch (urlParams.get('tab')) {
      case 'info':
        tab = 'Info';
        break;
      case 'in_metrics':
        tab = 'Inbound Metrics';
        break;
      case 'out_metrics':
        tab = 'Outbound Metrics';
        break;
      default:
        tab = 'Info';
    }
    return (
      <Breadcrumb title={true}>
        <Breadcrumb.Item componentClass="span">
          <ListPageLink target={TargetPage.APPLICATIONS}>Applications</ListPageLink>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass="span">
          <ListPageLink target={TargetPage.APPLICATIONS} namespace={this.props.match.params.namespace}>
            Namespace: {this.props.match.params.namespace}
          </ListPageLink>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass="span">
          <Link to={to}>App: {this.props.match.params.app}</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item active={true}>App {tab}</Breadcrumb.Item>
      </Breadcrumb>
    );
  };

  render() {
    return (
      <>
        {this.renderBreadcrumbs()}
        <TabContainer id="basic-tabs" activeKey={this.activeTab('tab', 'info')} onSelect={this.tabSelectHandler('tab')}>
          <div>
            <Nav bsClass="nav nav-tabs nav-tabs-pf">
              <NavItem eventKey="info">
                <div>Info</div>
              </NavItem>
              <NavItem eventKey="in_metrics">
                <div>Inbound Metrics</div>
              </NavItem>
              <NavItem eventKey="out_metrics">
                <div>Outbound Metrics</div>
              </NavItem>
            </Nav>
            <TabContent>
              <TabPane eventKey="info">
                <AppInfo
                  app={this.state.app}
                  namespace={this.props.match.params.namespace}
                  onRefresh={this.fetchApp}
                  activeTab={this.activeTab}
                  onSelectTab={this.tabSelectHandler}
                  health={this.state.health}
                />
              </TabPane>
              <TabPane eventKey="in_metrics" mountOnEnter={true} unmountOnExit={true}>
                <AppMetricsContainer
                  namespace={this.props.match.params.namespace}
                  object={this.props.match.params.app}
                  objectType={MetricsObjectTypes.APP}
                  direction={MetricsDirection.INBOUND}
                />
              </TabPane>
              <TabPane eventKey="out_metrics" mountOnEnter={true} unmountOnExit={true}>
                <AppMetricsContainer
                  namespace={this.props.match.params.namespace}
                  object={this.props.match.params.app}
                  objectType={MetricsObjectTypes.APP}
                  direction={MetricsDirection.OUTBOUND}
                />
              </TabPane>
            </TabContent>
          </div>
        </TabContainer>
      </>
    );
  }

  private activeTab = (tabName: string, whenEmpty: string) => {
    return new URLSearchParams(this.props.location.search).get(tabName) || whenEmpty;
  };

  private tabSelectHandler = (tabName: string) => {
    return (tabKey?: string) => {
      if (!tabKey) {
        return;
      }

      const urlParams = new URLSearchParams('');
      urlParams.set(tabName, tabKey);

      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
    };
  };
}

export default AppDetails;
