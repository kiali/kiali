import * as React from 'react';
import FlexView from 'react-flexview';
import { Breadcrumb, Icon, Button } from 'patternfly-react';

import { PollIntervalInMs } from '../../types/Common';
import Namespace from '../../types/Namespace';
import { GraphParamsType, SummaryData, NodeParamsType, GraphType } from '../../types/Graph';
import { Duration, Layout, EdgeLabelMode } from '../../types/GraphFilter';

import SummaryPanel from './SummaryPanel';
import CytoscapeGraph from '../../components/CytoscapeGraph/CytoscapeGraph';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import GraphFilterToolbar from '../../components/GraphFilter/GraphFilterToolbar';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import { style } from 'typestyle';

import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import * as MessageCenterUtils from '../../utils/MessageCenter';

import GraphLegend from '../../components/GraphFilter/GraphLegend';
import EmptyGraphLayoutContainer from '../../containers/EmptyGraphLayoutContainer';
import { CytoscapeToolbar } from '../../components/CytoscapeGraph/CytoscapeToolbar';
import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../../components/Nav/NavUtils';

import StatefulTour from '../../components/Tour/StatefulTour';

import graphHelp from './GraphHelpTour';

type GraphPageProps = GraphParamsType & {
  graphTimestamp: string;
  graphData: any;
  isLoading: boolean;
  showLegend: boolean;
  isReady: boolean;
  fetchGraphData: (
    namespace: Namespace,
    graphDuration: Duration,
    graphType: GraphType,
    injectServiceNodes: boolean,
    edgeLabelMode: EdgeLabelMode,
    showSecurity: boolean,
    showUnusedNodes: boolean,
    node?: NodeParamsType
  ) => any;
  toggleLegend: () => void;
  summaryData: SummaryData | null;
  pollInterval: PollIntervalInMs;
  isPageVisible: boolean;
  showSecurity: boolean;
  showUnusedNodes: boolean;
  isError: boolean;
};

type GraphPageState = {
  showHelp: boolean;
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

const GraphErrorBoundaryFallback = () => {
  return (
    <div className={cytoscapeGraphContainerStyle}>
      <EmptyGraphLayoutContainer isError={true} />
    </div>
  );
};

export default class GraphPage extends React.Component<GraphPageProps, GraphPageState> {
  static contextTypes = {
    router: () => null
  };

  private pollTimeoutRef?: number;
  private pollPromise?: CancelablePromise<any>;
  private readonly errorBoundaryRef: any;
  private cytoscapeGraphRef: any;

  constructor(props: GraphPageProps) {
    super(props);
    this.errorBoundaryRef = React.createRef();
    this.cytoscapeGraphRef = React.createRef();
    this.state = {
      showHelp: false
    };
  }

  componentDidMount() {
    this.scheduleNextPollingInterval(0);
  }

  componentWillUnmount() {
    this.removePollingIntervalTimer();
  }

  componentDidUpdate(prevProps: GraphPageProps) {
    const prevNamespace = prevProps.namespace;
    const prevDuration = prevProps.graphDuration;
    const prevGraphType = prevProps.graphType;
    const prevPollInterval = prevProps.pollInterval;
    const prevInjectServiceNodes = prevProps.injectServiceNodes;

    const namespaceHasChanged = prevNamespace.name !== this.props.namespace.name;
    const nodeHasChanged = prevProps.node !== this.props.node;
    const graphTypeHasChanged = prevGraphType !== this.props.graphType;
    const durationHasChanged = prevDuration.value !== this.props.graphDuration.value;
    const pollIntervalChanged = prevPollInterval !== this.props.pollInterval;
    const injectServiceNodesHasChanged = prevInjectServiceNodes !== this.props.injectServiceNodes;

    if (
      namespaceHasChanged ||
      graphTypeHasChanged ||
      nodeHasChanged ||
      durationHasChanged ||
      injectServiceNodesHasChanged
    ) {
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

    if (this.props.showLegend && this.state.showHelp) {
      this.setState({ showHelp: false });
    }
  }

  handleRefreshClick = () => {
    this.scheduleNextPollingInterval(0);
  };

  handleLayoutChange = (layout: Layout) => {
    const params = this.getGraphParams();
    if (params.node) {
      this.context.router.history.replace(makeNodeGraphUrlFromParams({ ...params, graphLayout: layout }));
    } else {
      this.context.router.history.replace(makeNamespaceGraphUrlFromParams({ ...params, graphLayout: layout }));
    }
  };

  toggleHelp = () => {
    if (this.props.showLegend) {
      this.props.toggleLegend();
    }
    this.setState({
      showHelp: !this.state.showHelp
    });
  };

  render() {
    const graphParams: GraphParamsType = {
      namespace: this.props.namespace,
      node: this.props.node,
      graphLayout: this.props.graphLayout,
      edgeLabelMode: this.props.edgeLabelMode,
      graphDuration: this.props.graphDuration,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.injectServiceNodes
    };
    return (
      <>
        <StatefulTour steps={graphHelp} isOpen={this.state.showHelp} onClose={this.toggleHelp} />
        <FlexView className={containerStyle} column={true}>
          <Breadcrumb title={true}>
            <Breadcrumb.Item active={true}>
              Graph{' '}
              <Button bsStyle="link" onClick={this.toggleHelp}>
                <Icon title="Help" type="pf" name="help" />
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb>
          <div>
            {/* Use empty div to reset the flex, this component doesn't seem to like that. It renders all its contents in the center */}
            <GraphFilterToolbar
              isLoading={this.props.isLoading}
              showSecurity={this.props.showSecurity}
              showUnusedNodes={this.props.showUnusedNodes}
              handleRefreshClick={this.handleRefreshClick}
              {...graphParams}
            />
          </div>
          <FlexView grow={true} className={cytoscapeGraphWrapperDivStyle}>
            <ErrorBoundary
              ref={this.errorBoundaryRef}
              onError={this.notifyError}
              fallBackComponent={<GraphErrorBoundaryFallback />}
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
                    activeLayout={this.props.graphLayout}
                    onLayoutChange={this.handleLayoutChange}
                    toggleLegend={this.props.toggleLegend}
                  />
                </div>
              ) : null}
            </ErrorBoundary>
            {this.props.summaryData ? (
              <SummaryPanel
                data={this.props.summaryData}
                namespace={this.props.namespace.name}
                graphType={this.props.graphType}
                injectServiceNodes={this.props.injectServiceNodes}
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
    const promise = this.props.fetchGraphData(
      this.props.namespace,
      this.props.graphDuration,
      this.props.graphType,
      this.props.injectServiceNodes,
      this.props.edgeLabelMode,
      this.props.showSecurity,
      this.props.showUnusedNodes,
      this.props.node
    );
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

    if (pollInterval === 0) {
      this.loadGraphDataFromBackend();
    } else {
      // We are using setTimeout instead of setInterval because we have more control over it
      // e.g. If a request takes much time, the next interval will fire up anyway and is
      // possible that it will take much time as well. Instead wait for it to timeout/error to
      // try again.
      this.pollTimeoutRef = window.setTimeout(this.loadGraphDataFromBackend, pollInterval);
    }
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

  private getGraphParams: () => GraphParamsType = () => {
    return {
      namespace: this.props.namespace,
      node: this.props.node,
      graphDuration: this.props.graphDuration,
      graphLayout: this.props.graphLayout,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.injectServiceNodes
    };
  };
}
