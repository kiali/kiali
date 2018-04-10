import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { Alert, Button } from 'patternfly-react';
import { PropTypes } from 'prop-types';

import Namespace from '../../types/Namespace';
import { GraphParamsType } from '../../types/Graph';
import { Duration, Layout } from '../../types/GraphFilter';

import SummaryPanel from './SummaryPanel';
import CytoscapeLayout from '../../components/CytoscapeLayout/CytoscapeLayout';
import * as LayoutDictionary from '../../components/CytoscapeLayout/graphs/LayoutDictionary';
import { GraphFilter } from '../../components/GraphFilter/GraphFilter';
import * as QueryOptions from '../../components/GraphFilter/QueryOptions';
import PfContainerNavVertical from '../../components/Pf/PfContainerNavVertical';
import PfHeader from '../../components/Pf/PfHeader';
import * as API from '../../services/Api';

const URLSearchParams = require('url-search-params');

// summaryData will have two fields:
//   summaryTarget: The cytoscape element
//   summaryType  : one of 'graph', 'node', 'edge', 'group'
type ServiceGraphPageState = {
  alertVisible: boolean;
  alertDetails: string;
  summaryData: any;
  graphTimestamp: string;
  graphData: any;
  isLoading: boolean;
  params: GraphParamsType;
};

type ServiceGraphPageProps = {
  duration: string;
  namespace: string;
  layout: string;
};
const EMPTY_GRAPH_DATA = { nodes: [], edges: [] };

export default class ServiceGraphPage extends React.Component<
  RouteComponentProps<ServiceGraphPageProps>,
  ServiceGraphPageState
> {
  static contextTypes = {
    router: PropTypes.object
  };

  constructor(routeProps: RouteComponentProps<ServiceGraphPageProps>) {
    super(routeProps);

    const { graphDuration, graphLayout } = this.parseProps(routeProps.location.search);
    this.state = {
      isLoading: false,
      alertVisible: false,
      alertDetails: '',
      summaryData: { summaryType: 'graph' },
      graphTimestamp: new Date().toLocaleString(),
      graphData: EMPTY_GRAPH_DATA,
      params: {
        namespace: { name: routeProps.match.params.namespace },
        graphDuration: graphDuration,
        graphLayout: graphLayout
      }
    };
  }

  parseProps = (queryString: string) => {
    const urlParams = new URLSearchParams(queryString);
    // TODO: [KIALI-357] validate `duration`
    const duration = urlParams.get('duration');
    return {
      graphDuration: duration ? { value: duration } : { value: QueryOptions.DEFAULT.key },
      graphLayout: LayoutDictionary.getLayout({ name: urlParams.get('layout') })
    };
  };

  componentDidMount() {
    this.loadGraphDataFromBackend();
  }

  componentWillReceiveProps(nextProps: RouteComponentProps<ServiceGraphPageProps>) {
    const nextNamespace = { name: nextProps.match.params.namespace };
    const { graphDuration: nextDuration, graphLayout: nextLayout } = this.parseProps(nextProps.location.search);

    const layoutHasChanged = nextLayout.name !== this.state.params.graphLayout.name;
    const namespaceHasChanged = nextNamespace.name !== this.state.params.namespace.name;
    const durationHasChanged = nextDuration.value !== this.state.params.graphDuration.value;

    if (layoutHasChanged || namespaceHasChanged || durationHasChanged) {
      const newParams = {
        namespace: nextNamespace,
        graphDuration: nextDuration,
        graphLayout: nextLayout
      };
      this.setState({ params: newParams });

      if (!layoutHasChanged) {
        // we need to explicitly provide namespace and duration because
        // the above setState() is async.
        this.loadGraphDataFromBackend(nextNamespace, nextDuration);
      }
    }
  }

  handleError = (error: string) => {
    this.setState({ alertVisible: true, alertDetails: error });
  };

  dismissAlert = () => {
    this.setState({ alertVisible: false });
  };

  handleGraphClick = (data: any) => {
    if (data !== undefined) {
      this.setState({ summaryData: data });
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
          <GraphFilter
            onLayoutChange={this.handleLayoutChange}
            onFilterChange={this.handleFilterChange}
            onNamespaceChange={this.handleNamespaceChange}
            onError={this.handleError}
            activeNamespace={this.state.params.namespace}
            activeLayout={this.state.params.graphLayout}
            activeDuration={this.state.params.graphDuration}
          />
          <Button onClick={this.onRefreshButtonClick}>Refresh</Button>
        </PfHeader>
        <div style={{ position: 'relative' }}>
          <SummaryPanel
            data={this.state.summaryData}
            namespace={this.state.params.namespace.name}
            queryTime={this.state.graphTimestamp}
            duration={this.state.params.graphDuration.value}
            {...QueryOptions.getOption(this.state.params.graphDuration.value)}
          />
          <CytoscapeLayout
            {...this.state.params}
            elements={this.state.graphData}
            isLoading={this.state.isLoading}
            onClick={this.handleGraphClick}
            refresh={this.onRefreshButtonClick}
          />
        </div>
      </PfContainerNavVertical>
    );
  }

  handleLayoutChange = (newLayout: Layout) => {
    console.log(`ServiceGraphpage.handleLayoutChange(), ${this.state.params.graphLayout} --> ${newLayout}`);
    this.navigate(this.makeUrlFrom(this.state.params.namespace, newLayout, this.state.params.graphDuration));
  };

  handleFilterChange = (newDuration: Duration) => {
    console.log(`ServiceGraphpage.handleFilterChange(), ${this.state.params.graphDuration} --> ${newDuration}`);
    this.navigate(this.makeUrlFrom(this.state.params.namespace, this.state.params.graphLayout, newDuration));
  };

  handleNamespaceChange = (newNS: Namespace) => {
    console.log(`ServiceGraphpage.handleNamespaceChange(), ${this.state.params.namespace} --> ${newNS}`);
    this.navigate(this.makeUrlFrom(newNS, this.state.params.graphLayout, this.state.params.graphDuration));
  };

  makeUrlFrom = (_namespace: Namespace, _layout: Layout, _duration: Duration) =>
    `/service-graph/${_namespace.name}?layout=${_layout.name}&duration=${_duration.value}`;

  /** Update browser address bar  */
  navigate = newUrl => this.context.router.history.push(newUrl);

  onRefreshButtonClick = event => {
    this.loadGraphDataFromBackend();
  };

  /** Fetch graph data */
  loadGraphDataFromBackend = (namespace?: Namespace, graphDuration?: Duration) => {
    this.setState({ isLoading: true });
    namespace = namespace ? namespace : this.state.params.namespace;
    const duration = graphDuration ? graphDuration.value : this.state.params.graphDuration.value;
    const restParams = { duration: duration + 's' };
    console.log('loadGraphDataFromBackend()', namespace, restParams);
    API.GetGraphElements(namespace, restParams)
      .then(response => {
        const responseData = response['data'];
        const elements = responseData && responseData.elements ? responseData.elements : EMPTY_GRAPH_DATA;
        const timestamp = responseData && responseData.timestamp ? responseData.timestamp : '';
        this.setState({ graphData: elements, graphTimestamp: timestamp, isLoading: false });
      })
      .catch(error => {
        this.setState({
          graphData: EMPTY_GRAPH_DATA,
          graphTimestamp: new Date().toLocaleString(),
          isLoading: false
        });
        console.error(error);
      });
  };
}
