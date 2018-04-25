import * as React from 'react';

import Namespace from '../../types/Namespace';
import { GraphParamsType } from '../../types/Graph';
import { Duration, Layout, BadgeStatus } from '../../types/GraphFilter';

import SummaryPanel from './SummaryPanel';
import CytoscapeLayout from '../../components/CytoscapeLayout/CytoscapeLayout';
import GraphFilter from '../../components/GraphFilter/GraphFilter';
import PfContainerNavVertical from '../../components/Pf/PfContainerNavVertical';
// import PfHeader from '../../components/Pf/PfHeader';
import PfAlerts from '../../components/Pf/PfAlerts';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';

// summaryData will have two fields:
//   summaryTarget: The cytoscape element
//   summaryType  : one of 'graph', 'node', 'edge', 'group'
type ServiceGraphPageState = {
  alertVisible: boolean;
  alertDetails: {
    namespaceAlert?: any;
    graphLoadAlert?: any;
  };
  summaryData: any;
  graphTimestamp: string;
  graphData: any;
  isLoading: boolean;
  isReady: boolean;
};

type ServiceGraphPageProps = GraphParamsType & {
  onParamsChange: (params: GraphParamsType) => void;
};
const EMPTY_GRAPH_DATA = { nodes: [], edges: [] };
const NUMBER_OF_DATAPOINTS = 30;

export default class ServiceGraphPage extends React.Component<ServiceGraphPageProps, ServiceGraphPageState> {
  // avoid state changes after component is unmounted
  _isMounted: boolean = false;

  constructor(props: ServiceGraphPageProps) {
    super(props);

    this.state = {
      isLoading: false,
      isReady: false,
      alertVisible: false,
      alertDetails: {},
      summaryData: { summaryType: 'graph' },
      graphTimestamp: new Date().toLocaleString(),
      graphData: EMPTY_GRAPH_DATA
    };
  }

  componentDidMount() {
    this._isMounted = true;
    this.loadGraphDataFromBackend();
  }

  componentWillReceiveProps(nextProps: ServiceGraphPageProps) {
    const nextNamespace = nextProps.namespace;
    const nextDuration = nextProps.graphDuration;

    const namespaceHasChanged = nextNamespace.name !== this.props.namespace.name;
    const durationHasChanged = nextDuration.value !== this.props.graphDuration.value;

    if (namespaceHasChanged || durationHasChanged) {
      this.loadGraphDataFromBackend(nextNamespace, nextDuration);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  dismissAlert = () => {
    this.setState({ alertVisible: false, alertDetails: {} });
  };

  handleGraphClick = (data: any) => {
    if (data) {
      this.setState({ summaryData: data });
    }
  };

  handleReady = (cy: any) => {
    if (cy) {
      this.setState({ summaryData: { summaryType: 'graph', summaryTarget: cy } });
    }
  };

  handleRefreshClick = () => {
    this.loadGraphDataFromBackend();
  };

  render() {
    const graphParams: GraphParamsType = {
      namespace: this.props.namespace,
      graphLayout: this.props.graphLayout,
      graphDuration: this.props.graphDuration,
      badgeStatus: this.props.badgeStatus
    };
    return (
      <PfContainerNavVertical>
        <h2>Service Graph</h2>
        <PfAlerts alerts={this.buildAlertsArray()} isVisible={this.state.alertVisible} onDismiss={this.dismissAlert} />
        <GraphFilter
          disabled={this.state.isLoading}
          onLayoutChange={this.handleLayoutChange}
          onFilterChange={this.handleFilterChange}
          onNamespaceChange={this.handleNamespaceChange}
          onBadgeStatusChange={this.handleBadgeStatusChange}
          onRefresh={this.handleRefreshClick}
          {...graphParams}
        />
        <div style={{ position: 'absolute', right: 20, bottom: 0, top: 230, left: 220 }}>
          <CytoscapeLayout
            {...graphParams}
            isLoading={this.state.isLoading}
            isReady={this.state.isReady}
            elements={this.state.graphData}
            onClick={this.handleGraphClick}
            onReady={this.handleReady}
            refresh={this.handleRefreshClick}
          />
          <SummaryPanel
            data={this.state.summaryData}
            namespace={this.props.namespace.name}
            queryTime={this.state.graphTimestamp}
            duration={this.props.graphDuration.value}
            {...computePrometheusQueryInterval(this.props.graphDuration.value, NUMBER_OF_DATAPOINTS)}
          />
        </div>
      </PfContainerNavVertical>
    );
  }

  handleLayoutChange = (layout: Layout) => {
    const newParams: GraphParamsType = {
      namespace: this.props.namespace,
      graphDuration: this.props.graphDuration,
      graphLayout: layout,
      badgeStatus: this.props.badgeStatus
    };
    this.props.onParamsChange(newParams);
  };

  handleFilterChange = (duration: Duration) => {
    const newParams: GraphParamsType = {
      namespace: this.props.namespace,
      graphDuration: duration,
      graphLayout: this.props.graphLayout,
      badgeStatus: this.props.badgeStatus
    };
    this.props.onParamsChange(newParams);
  };

  handleNamespaceChange = (namespace: Namespace) => {
    const newParams: GraphParamsType = {
      namespace: namespace,
      graphDuration: this.props.graphDuration,
      graphLayout: this.props.graphLayout,
      badgeStatus: this.props.badgeStatus
    };
    this.props.onParamsChange(newParams);
  };

  handleBadgeStatusChange = (newBS: BadgeStatus) => {
    const newParams: GraphParamsType = {
      namespace: this.props.namespace,
      graphDuration: this.props.graphDuration,
      graphLayout: this.props.graphLayout,
      badgeStatus: newBS
    };
    this.props.onParamsChange(newParams);
  };

  /** Fetch graph data */
  loadGraphDataFromBackend = (namespace?: Namespace, graphDuration?: Duration) => {
    this.setState({ isLoading: true, isReady: false });
    namespace = namespace ? namespace : this.props.namespace;
    const duration = graphDuration ? graphDuration.value : this.props.graphDuration.value;
    const restParams = { duration: duration + 's' };
    API.getGraphElements(namespace, restParams)
      .then(response => {
        if (!this._isMounted) {
          console.log('ServiceGraphPage: Ignore fetch, component not mounted.');
          return;
        }
        const responseData = response['data'];
        const elements = responseData && responseData.elements ? responseData.elements : EMPTY_GRAPH_DATA;
        const timestamp = responseData && responseData.timestamp ? responseData.timestamp : '';
        this.setState({
          graphData: elements,
          graphTimestamp: timestamp,
          summaryData: { summaryType: 'graph', summaryTarget: null },
          isLoading: false
        });
      })
      .catch(error => {
        if (!this._isMounted) {
          console.log('ServiceGraphPage: Ignore fetch error, component not mounted.');
          return;
        }
        this.setState({
          graphData: EMPTY_GRAPH_DATA,
          graphTimestamp: new Date().toLocaleString(),
          summaryData: { summaryType: 'graph', summaryTarget: null },
          isLoading: false,
          alertVisible: true,
          alertDetails: { ...this.state.alertDetails, graphLoadAlert: error }
        });
      });
  };

  private buildAlertsArray = () => {
    let alerts: string[] = [];

    if (this.state.alertDetails.namespaceAlert) {
      alerts.push('Cannot load namespace list: ' + this.state.alertDetails.namespaceAlert.toString());
    }

    let graphAlert = this.state.alertDetails.graphLoadAlert;
    if (graphAlert) {
      if (graphAlert.response && graphAlert.response.data && graphAlert.response.data.error) {
        alerts.push('Cannot load the graph: ' + graphAlert.response.data.error);
      } else {
        alerts.push('Cannot load the graph: ' + graphAlert.toString());
      }
    }

    return alerts;
  };
}
