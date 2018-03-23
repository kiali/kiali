import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { PropTypes } from 'prop-types';
import NamespaceId from '../../types/NamespaceId';
import { Alert } from 'patternfly-react';
import CytoscapeLayout from '../../components/CytoscapeLayout/CytoscapeLayout';
import SummaryPanel from './SummaryPanel';
import { GraphFilter, GraphFilters } from '../../components/GraphFilter/GraphFilter';
import PfContainerNavVertical from '../../components/Pf/PfContainerNavVertical';
import PfHeader from '../../components/Pf/PfHeader';

const URLSearchParams = require('url-search-params');

// summaryData will have two fields:
//   summaryTarget: The cytoscape element
//   summaryType  : one of 'graph', 'node', 'edge', 'group'
type ServiceGraphPageProps = {
  alertVisible: boolean;
  alertDetails: string;
  summaryData: any;
  updateTime: string;
};

export default class ServiceGraphPage extends React.Component<RouteComponentProps<NamespaceId>, ServiceGraphPageProps> {
  static contextTypes = {
    router: PropTypes.object
  };

  constructor(routeProps: RouteComponentProps<NamespaceId>) {
    super(routeProps);
    this.state = {
      alertVisible: false,
      alertDetails: '',
      summaryData: { summaryType: 'graph' },
      updateTime: new Date().toLocaleString()
    };

    this.filterChange = this.filterChange.bind(this);
    this.handleGraphClick = this.handleGraphClick.bind(this);
    this.handleError = this.handleError.bind(this);

    const search = routeProps.location.search;
    const params = new URLSearchParams(search);
    let graphDuration = params.get('duration');
    let graphLayout = params.get('layout');

    GraphFilters.setGraphNamespace(routeProps.match.params.namespace);
    GraphFilters.setGraphDuration(graphDuration ? graphDuration : '600');
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
      `/service-graph/${GraphFilters.getGraphNamespace()}?layout=${GraphFilters.getGraphLayoutName()}&duration=${GraphFilters.getGraphDuration()}`
    );
  }

  handleGraphClick = (data: any) => {
    if (data !== undefined) {
      this.setState({ summaryData: data, updateTime: new Date().toLocaleString() });
    }
  };

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
      <PfContainerNavVertical>
        <PfHeader>
          <h2>Service Graph</h2>
          {alertsDiv}
          <GraphFilter onFilterChange={this.filterChange} onError={this.handleError} />
        </PfHeader>
        <div style={{ position: 'relative' }}>
          <SummaryPanel
            data={this.state.summaryData}
            namespace={GraphFilters.getGraphNamespace()}
            duration={GraphFilters.getGraphDuration()}
            step={GraphFilters.getGraphStep()}
            rateInterval={GraphFilters.getGraphRateInterval()}
          />
          <CytoscapeLayout
            namespace={GraphFilters.getGraphNamespace()}
            layout={GraphFilters.getGraphLayout()}
            duration={GraphFilters.getGraphDuration()}
            onClick={this.handleGraphClick}
          />
        </div>
      </PfContainerNavVertical>
    );
  }
}
