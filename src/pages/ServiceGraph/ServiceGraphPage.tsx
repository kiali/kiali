import * as React from 'react';

import Namespace from '../../types/Namespace';
import { GraphParamsType, SummaryData } from '../../types/Graph';
import { Duration, Layout } from '../../types/GraphFilter';

import SummaryPanel from './SummaryPanel';
import CytoscapeGraph from '../../components/CytoscapeGraph/CytoscapeGraph';
import GraphFilter from '../../components/GraphFilter/GraphFilter';
import PfContainerNavVertical from '../../components/Pf/PfContainerNavVertical';
import { computePrometheusQueryInterval } from '../../services/Prometheus';

type ServiceGraphPageState = {
  summaryData?: SummaryData | null;
};

type ServiceGraphPageProps = GraphParamsType & {
  graphTimestamp: string;
  graphData: any;
  isLoading: boolean;
  isReady: boolean;
  onParamsChange: (params: GraphParamsType) => void;
  fetchGraphData: (namespace: Namespace, graphDuration: Duration) => any;
};
const NUMBER_OF_DATAPOINTS = 30;

export default class ServiceGraphPage extends React.Component<ServiceGraphPageProps, ServiceGraphPageState> {
  constructor(props: ServiceGraphPageProps) {
    super(props);

    this.state = {
      summaryData: { summaryType: 'graph', summaryTarget: null }
    };
  }

  componentDidMount() {
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

  handleGraphClick = (data: SummaryData) => {
    if (data) {
      this.setState({ summaryData: data });
    }
  };

  handleReady = (cy: any) => {
    if (cy) {
      this.setState({
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
      graphDuration: { value: Number(sessionStorage.getItem('appDuration')) } || this.props.graphDuration
    };
    return (
      <PfContainerNavVertical>
        <h2>Service Graph</h2>
        <GraphFilter
          disabled={this.props.isLoading}
          onLayoutChange={this.handleLayoutChange}
          onFilterChange={this.handleFilterChange}
          onNamespaceChange={this.handleNamespaceChange}
          onRefresh={this.handleRefreshClick}
          {...graphParams}
        />
        <div style={{ position: 'absolute', right: 20, bottom: 0, top: 230, left: 220 }}>
          <CytoscapeGraph
            {...graphParams}
            isLoading={this.props.isLoading}
            isReady={this.props.isReady}
            elements={this.props.graphData}
            onClick={this.handleGraphClick}
            onReady={this.handleReady}
            refresh={this.handleRefreshClick}
          />
          {this.state.summaryData ? (
            <SummaryPanel
              data={this.state.summaryData}
              namespace={this.props.namespace.name}
              queryTime={this.props.graphTimestamp}
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
      graphLayout: layout
    };
    this.props.onParamsChange(newParams);
  };

  handleFilterChange = (duration: Duration) => {
    const newParams: GraphParamsType = {
      namespace: this.props.namespace,
      graphDuration: duration,
      graphLayout: this.props.graphLayout
    };
    this.props.onParamsChange(newParams);
  };

  handleNamespaceChange = (namespace: Namespace) => {
    const newParams: GraphParamsType = {
      namespace: namespace,
      graphDuration: this.props.graphDuration,
      graphLayout: this.props.graphLayout
    };
    this.props.onParamsChange(newParams);
  };

  /** Fetch graph data */
  loadGraphDataFromBackend = (namespace?: Namespace, graphDuration?: Duration) => {
    namespace = namespace ? namespace : this.props.namespace;
    graphDuration = graphDuration ? graphDuration : this.props.graphDuration;
    this.props.fetchGraphData(namespace, graphDuration);
    this.setState({
      summaryData: null
    });
  };
}
