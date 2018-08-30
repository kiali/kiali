import * as React from 'react';
import FlexView from 'react-flexview';

import { Breadcrumb } from 'patternfly-react';

import Namespace from '../../types/Namespace';
import { GraphParamsType, SummaryData, GraphType } from '../../types/Graph';
import { Duration, PollIntervalInMs } from '../../types/GraphFilter';

import SummaryPanel from './SummaryPanel';
import CytoscapeGraph from '../../components/CytoscapeGraph/CytoscapeGraph';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import GraphFilterToolbar from '../../components/GraphFilter/GraphFilterToolbar';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import { style } from 'typestyle';

import { CancelablePromise, makeCancelablePromise } from '../../utils/Common';
import * as MessageCenterUtils from '../../utils/MessageCenter';

import GraphLegend from '../../components/GraphFilter/GraphLegend';
import EmptyGraphLayoutContainer from '../../containers/EmptyGraphLayoutContainer';
import { CytoscapeToolbar } from '../../components/CytoscapeGraph/CytoscapeToolbar';

type ServiceGraphPageProps = GraphParamsType & {
  graphTimestamp: string;
  graphData: any;
  isLoading: boolean;
  showLegend: boolean;
  isReady: boolean;
  fetchGraphData: (namespace: Namespace, graphDuration: Duration, graphType: GraphType) => any;
  toggleLegend: () => void;
  summaryData: SummaryData | null;
  pollInterval: PollIntervalInMs;
  isPageVisible: boolean;
  isError: boolean;
};
const NUMBER_OF_DATAPOINTS = 30;

const containerStyle = style({
  minHeight: '350px',
  height: 'calc(100vh - 60px)' // View height minus top bar height
});

const cytoscapeGraphContainerStyle = style({ flex: '1', minWidth: '350px', zIndex: 0, paddingRight: '5px' });
const cytoscapeGraphWrapperDivStyle = style({ position: 'relative' });
const cytoscapeToolbarWrapperDivStyle = style({
  position: 'absolute',
  bottom: '10px',
  left: '-13px',
  zIndex: 2,
  boxShadow: '2px 2px 6px 0 grey'
});

const graphToolbarStyle = style({
  right: '0',
  bottom: '10px',
  zIndex: 9999,
  position: 'absolute'
});

const ServiceGraphErrorBoundaryFallback = () => {
  return (
    <div className={cytoscapeGraphContainerStyle}>
      <EmptyGraphLayoutContainer isError={true} />
    </div>
  );
};

export default class ServiceGraphPage extends React.PureComponent<ServiceGraphPageProps> {
  private pollTimeoutRef?: number;
  private pollPromise?: CancelablePromise<any>;
  private readonly errorBoundaryRef: any;
  private cytoscapeGraphRef: any;

  constructor(props: ServiceGraphPageProps) {
    super(props);
    this.errorBoundaryRef = React.createRef();
    this.cytoscapeGraphRef = React.createRef();
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
    if (
      prevProps.graphLayout.name !== this.props.graphLayout.name ||
      prevProps.graphData !== this.props.graphData ||
      namespaceHasChanged
    ) {
      this.errorBoundaryRef.current.cleanError();
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
      graphDuration: this.props.graphDuration,
      graphType: this.props.graphType
    };
    return (
      <>
        <FlexView className={containerStyle} column={true}>
          <Breadcrumb title={true}>
            <Breadcrumb.Item active={true}>Graph</Breadcrumb.Item>
          </Breadcrumb>
          <div>
            {/* Use empty div to reset the flex, this component doesn't seem to like that. It renders all its contents in the center */}
            <GraphFilterToolbar
              isLoading={this.props.isLoading}
              handleRefreshClick={this.handleRefreshClick}
              {...graphParams}
            />
          </div>
          <FlexView grow={true} className={cytoscapeGraphWrapperDivStyle}>
            <ErrorBoundary
              ref={this.errorBoundaryRef}
              onError={this.notifyError}
              fallBackComponent={<ServiceGraphErrorBoundaryFallback />}
            >
              <CytoscapeGraph
                {...graphParams}
                isLoading={this.props.isLoading}
                elements={this.props.graphData}
                refresh={this.handleRefreshClick}
                containerClassName={cytoscapeGraphContainerStyle}
                ref={refInstance => this.setCytoscapeGraph(refInstance)}
              />
              {this.props.graphData.nodes &&
              Object.keys(this.props.graphData.nodes).length > 0 &&
              !this.props.isError ? (
                <div className={cytoscapeToolbarWrapperDivStyle}>
                  <CytoscapeToolbar
                    cytoscapeGraphRef={this.cytoscapeGraphRef}
                    isLegendActive={this.props.showLegend}
                    toggleLegend={this.props.toggleLegend}
                  />
                </div>
              ) : null}
            </ErrorBoundary>
            {this.props.summaryData ? (
              <SummaryPanel
                data={this.props.summaryData}
                namespace={this.props.namespace.name}
                queryTime={this.props.graphTimestamp}
                duration={this.props.graphDuration.value}
                isPageVisible={this.props.isPageVisible}
                {...computePrometheusQueryInterval(this.props.graphDuration.value, NUMBER_OF_DATAPOINTS)}
              />
            ) : null}
            {this.props.showLegend && (
              <GraphLegend className={graphToolbarStyle} closeLegend={this.props.toggleLegend} />
            )}
          </FlexView>
        </FlexView>
      </>
    );
  }

  private setCytoscapeGraph(cytoscapeGraph: any) {
    this.cytoscapeGraphRef.current = cytoscapeGraph ? cytoscapeGraph.getWrappedInstance() : null;
  }

  private loadGraphDataFromBackend = () => {
    return this.props.fetchGraphData(this.props.namespace, this.props.graphDuration, this.props.graphType);
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

  private notifyError = (error: Error, _componentStack: string) => {
    MessageCenterUtils.add(
      `There was an error when rendering the graph: ${error.message}, please try a different layout`
    );
  };
}
