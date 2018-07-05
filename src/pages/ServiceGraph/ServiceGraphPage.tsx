import * as React from 'react';
import FlexView from 'react-flexview';

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

const containerStyle = style({
  minHeight: '350px',
  height: 'calc(100vh - 60px)' // View height minus top bar height
});

const cytoscapeGraphContainerStyle = style({ flex: '1', minWidth: 0 });

const makeCancelablePromise = (promise: Promise<any>) => {
  let hasCanceled = false;

  const wrappedPromise = new Promise((resolve, reject) => {
    promise.then(
      val => (hasCanceled ? reject({ isCanceled: true }) : resolve(val)),
      error => (hasCanceled ? reject({ isCanceled: true }) : reject(error))
    );
  });

  return {
    promise: wrappedPromise,
    cancel() {
      hasCanceled = true;
    }
  };
};

export default class ServiceGraphPage extends React.PureComponent<ServiceGraphPageProps> {
  private pollTimeoutRef?: number;
  private pollPromise?;
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
        <FlexView className={containerStyle} column={true}>
          <h2>Service Graph</h2>
          <div>
            {/* Use empty div to reset the flex, this component doesn't seem to like that. It renders all its contents in the center */}
            <GraphFilterToolbar
              isLoading={this.props.isLoading}
              handleRefreshClick={this.handleRefreshClick}
              {...graphParams}
            />
          </div>
          <FlexView grow={true}>
            <CytoscapeGraph
              {...graphParams}
              isLoading={this.props.isLoading}
              elements={this.props.graphData}
              refresh={this.handleRefreshClick}
              containerClassName={cytoscapeGraphContainerStyle}
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
            {this.props.showLegend && <GraphLegend closeLegend={this.props.toggleLegend} />}
          </FlexView>
        </FlexView>
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
      const promise = this.loadGraphDataFromBackend();
      this.pollPromise = makeCancelablePromise(promise);

      this.pollPromise.promise
        .then(() => {
          this.scheduleNextPollingIntervalFromProps();
        })
        .catch(error => {
          if (!error.isCanceled) {
            this.scheduleNextPollingIntervalFromProps();
          }
        });
    }, pollInterval);
  }

  private removePollingIntervalTimer() {
    if (this.pollTimeoutRef) {
      clearTimeout(this.pollTimeoutRef);
      this.pollTimeoutRef = undefined;
    }

    if (this.pollPromise) {
      this.pollPromise.cancel();
      this.pollPromise = undefined;
    }
  }
}
