import * as React from 'react';

import Namespace from '../../types/Namespace';
import { GraphParamsType, SummaryData } from '../../types/Graph';
import { Duration, PollIntervalInMs } from '../../types/GraphFilter';

import SummaryPanel from './SummaryPanel';
import CytoscapeGraph from '../../components/CytoscapeGraph/CytoscapeGraph';
import GraphFilterToolbar from '../../components/GraphFilter/GraphFilterToolbar';
import PfContainerNavVertical from '../../components/Pf/PfContainerNavVertical';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import { style } from 'typestyle';

import GraphLegend from '../../components/GraphFilter/GraphLegend';

type ServiceGraphPageProps = GraphParamsType & {
  graphTimestamp: string;
  graphData: any;
  isLoading: boolean;
  showLegend: boolean;
  isReady: boolean;
  fetchGraphData: (namespace: Namespace, graphDuration: Duration) => any;
  toggleLegend: () => void;
  summaryData: SummaryData | null;
  pollInterval: PollIntervalInMs;
};
const NUMBER_OF_DATAPOINTS = 30;

const cytscapeGraphStyle = style({
  position: 'absolute',
  right: 20,
  bottom: 0,
  top: 170,
  left: 220
});

export default class ServiceGraphPage extends React.PureComponent<ServiceGraphPageProps> {
  private pollTimeoutRef?: number;
  constructor(props: ServiceGraphPageProps) {
    super(props);
  }

  componentDidMount() {
    this.scheduleNextPollingInterval(0);
  }

  componentWillUnmount() {
    this.removePollingIntervalTimer();
  }

  componentDidUpdate(prevProps: ServiceGraphPageProps) {
    const prevNamespace = prevProps.namespace;
    const prevDuration = prevProps.graphDuration;
    const prevPollInterval = prevProps.pollInterval;

    const namespaceHasChanged = prevNamespace.name !== this.props.namespace.name;
    const durationHasChanged = prevDuration.value !== this.props.graphDuration.value;
    const pollIntervalChanged = prevPollInterval !== this.props.pollInterval;

    if (namespaceHasChanged || durationHasChanged) {
      this.scheduleNextPollingInterval(0);
    } else if (pollIntervalChanged) {
      this.scheduleNextPollingIntervalFromProps();
    }
  }

  handleRefreshClick = () => {
    this.scheduleNextPollingInterval(0);
  };

  render() {
    const graphParams: GraphParamsType = {
      namespace: this.props.namespace,
      graphLayout: this.props.graphLayout,
      edgeLabelMode: this.props.edgeLabelMode,
      graphDuration: this.props.graphDuration
    };
    return (
      <PfContainerNavVertical>
        <h2>Service Graph</h2>
        <GraphFilterToolbar
          isLoading={this.props.isLoading}
          handleRefreshClick={this.handleRefreshClick}
          {...graphParams}
        />
        <div className={cytscapeGraphStyle}>
          <CytoscapeGraph
            {...graphParams}
            isLoading={this.props.isLoading}
            elements={this.props.graphData}
            refresh={this.handleRefreshClick}
          />
          {this.props.summaryData ? (
            <SummaryPanel
              data={this.props.summaryData}
              namespace={this.props.namespace.name}
              queryTime={this.props.graphTimestamp}
              duration={this.props.graphDuration.value}
              {...computePrometheusQueryInterval(this.props.graphDuration.value, NUMBER_OF_DATAPOINTS)}
            />
          ) : null}
        </div>
        {this.props.showLegend && <GraphLegend closeLegend={this.props.toggleLegend} />}
      </PfContainerNavVertical>
    );
  }

  /** Fetch graph data */
  private loadGraphDataFromBackend = (namespace?: Namespace, graphDuration?: Duration) => {
    namespace = namespace ? namespace : this.props.namespace;
    graphDuration = graphDuration ? graphDuration : this.props.graphDuration;
    return this.props.fetchGraphData(namespace, graphDuration);
  };

  private scheduleNextPollingIntervalFromProps() {
    if (this.props.pollInterval > 0) {
      this.scheduleNextPollingInterval(this.props.pollInterval);
    } else {
      this.removePollingIntervalTimer();
    }
  }

  private scheduleNextPollingInterval(pollInterval: number) {
    // Remove any pending timeout to avoid having multiple requests at once
    this.removePollingIntervalTimer();
    // We are using setTimeout instead of setInterval because we have more control over it
    // e.g. If a request takes much time, the next interval will fire up anyway and is
    // possible that it will take much time as well. Instead wait for it to timeout/error to
    // try again.
    this.pollTimeoutRef = window.setTimeout(() => {
      this.loadGraphDataFromBackend()
        .then(() => {
          this.scheduleNextPollingIntervalFromProps();
        })
        .catch(() => {
          this.scheduleNextPollingIntervalFromProps();
        });
    }, pollInterval);
  }

  private removePollingIntervalTimer() {
    if (this.pollTimeoutRef) {
      clearTimeout(this.pollTimeoutRef);
      this.pollTimeoutRef = undefined;
    }
  }
}
