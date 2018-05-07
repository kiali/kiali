import * as React from 'react';

import Namespace from '../../types/Namespace';
import { GraphParamsType, SummaryData } from '../../types/Graph';
import { Duration, Layout, BadgeStatus } from '../../types/GraphFilter';

import SummaryPanel from './SummaryPanel';
import CytoscapeLayout from '../../components/CytoscapeLayout/CytoscapeLayout';
import GraphFilter from '../../components/GraphFilter/GraphFilter';
import PfContainerNavVertical from '../../components/Pf/PfContainerNavVertical';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import * as MessageCenter from '../../utils/MessageCenter';

type ServiceGraphPageState = {
  summaryData?: SummaryData | null;
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
      summaryData: { summaryType: 'graph', summaryTarget: null },
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

  handleGraphClick = (data: any) => {
    if (data) {
      this.setState({ summaryData: data });
    }
  };

  handleReady = (cy: any) => {
    if (cy) {
      this.setState({
        isReady: true,
        summaryData: {
          summaryType: 'graph',
          summaryTarget: cy
        }
      });
    }
  };

  handleRefreshClick = () => {
    this.loadGraphDataFromBackend();
  };

  render() {
    const graphParams: GraphParamsType = {
      namespace: this.props.namespace,
      graphLayout: this.props.graphLayout,
      graphDuration: { value: Number(sessionStorage.getItem('appDuration')) } || this.props.graphDuration,
      badgeStatus: this.props.badgeStatus
    };
    return (
      <PfContainerNavVertical>
        <h2>Service Graph</h2>
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
          {this.state.summaryData ? (
            <SummaryPanel
              data={this.state.summaryData}
              namespace={this.props.namespace.name}
              queryTime={this.state.graphTimestamp}
              duration={this.props.graphDuration.value}
              {...computePrometheusQueryInterval(this.props.graphDuration.value, NUMBER_OF_DATAPOINTS)}
            />
          ) : null}
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
          summaryData: null,
          isLoading: false
        });
      })
      .catch(error => {
        if (!this._isMounted) {
          console.log('ServiceGraphPage: Ignore fetch error, component not mounted.');
          return;
        }
        MessageCenter.add(this.getGraphErrorAsString(error));
        this.setState({
          graphData: EMPTY_GRAPH_DATA,
          graphTimestamp: new Date().toLocaleString(),
          summaryData: null,
          isLoading: false
        });
      });
  };

  private getGraphErrorAsString(error: any) {
    if (error.response && error.response.data && error.response.data.error) {
      return 'Cannot load the graph: ' + error.response.data.error;
    } else {
      return 'Cannot load the graph: ' + error.toString();
    }
  }
}
