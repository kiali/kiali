import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { PropTypes } from 'prop-types';
import NamespaceId from '../../types/NamespaceId';
import { Alert } from 'patternfly-react';
import CytoscapeLayout from '../../components/CytoscapeLayout/CytoscapeLayout';
import SummaryPanel from './SummaryPanel';
import { GraphFilter, GraphFilters } from '../../components/GraphFilter/GraphFilter';

const URLSearchParams = require('url-search-params');

type ServiceGraphPageProps = {
  alertVisible: boolean;
  alertDetails: string;
};

export default class ServiceGraphPage extends React.Component<RouteComponentProps<NamespaceId>, ServiceGraphPageProps> {
  static contextTypes = {
    router: PropTypes.object
  };

  constructor(routeProps: RouteComponentProps<NamespaceId>) {
    super(routeProps);
    this.state = {
      alertVisible: false,
      alertDetails: ''
    };

    this.filterChange = this.filterChange.bind(this);
    this.handleError = this.handleError.bind(this);

    const search = routeProps.location.search;
    const params = new URLSearchParams(search);
    let graphInterval = params.get('interval');
    let graphLayout = params.get('layout');

    GraphFilters.setGraphNamespace(routeProps.match.params.namespace);
    GraphFilters.setGraphInterval(graphInterval ? graphInterval : '30s');
    GraphFilters.setGraphLayout(graphLayout ? graphLayout : 'dagre');
  }

  componentDidMount() {
    // nothing to do yet
  }

  handleError = (error: string) => {
    this.setState({ alertVisible: true, alertDetails: error });
  };

  dismissAlert = () => {
    this.setState({ alertVisible: false });
  };

  filterChange() {
    this.context.router.history.push(
      `/service-graph/${GraphFilters.getGraphNamespace()}?layout=${GraphFilters.getGraphLayoutName()}&interval=${GraphFilters.getGraphInterval()}`
    );
  }

  render() {
    let alertsDiv = <div />;
    if (this.state.alertVisible) {
      alertsDiv = (
        <div>
          <Alert onDismiss={this.dismissAlert}>{this.state.alertDetails.toString()}</Alert>
        </div>
      );
    }
    return (
      <div className="container-fluid container-pf-nav-pf-vertical">
        <h2>Service Graph</h2>
        {alertsDiv}
        <div>
          <GraphFilter onFilterChange={this.filterChange} onError={this.handleError} />
        </div>
        <div style={{ position: 'relative' }}>
          <SummaryPanel />
          <CytoscapeLayout
            namespace={GraphFilters.getGraphNamespace()}
            layout={GraphFilters.getGraphLayout()}
            interval={GraphFilters.getGraphInterval()}
          />
        </div>
      </div>
    );
  }
}
