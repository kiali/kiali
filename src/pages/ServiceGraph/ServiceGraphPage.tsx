import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { PropTypes } from 'prop-types';

import Namespace from '../../types/Namespace';
import { GraphParamsType } from '../../types/Graph';
import { Duration, Layout, BadgeStatus } from '../../types/GraphFilter';

import SummaryPanel from './SummaryPanel';
import CytoscapeLayout from '../../components/CytoscapeLayout/CytoscapeLayout';
import * as LayoutDictionary from '../../components/CytoscapeLayout/graphs/LayoutDictionary';
import GraphFilter from '../../components/GraphFilter/GraphFilter';
import PfContainerNavVertical from '../../components/Pf/PfContainerNavVertical';
import PfHeader from '../../components/Pf/PfHeader';
import PfAlerts from '../../components/Pf/PfAlerts';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';

const URLSearchParams = require('url-search-params');

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
  params: GraphParamsType;
};

type ServiceGraphPageProps = {
  duration: string;
  namespace: string;
  layout: string;
  hideCBs: string;
};
const EMPTY_GRAPH_DATA = { nodes: [], edges: [] };
const DEFAULT_DURATION = 60;
const NUMBER_OF_DATAPOINTS = 30;

export default class ServiceGraphPage extends React.Component<
  RouteComponentProps<ServiceGraphPageProps>,
  ServiceGraphPageState
> {
  static contextTypes = {
    router: PropTypes.object
  };

  // avoid state changes after component is unmounted
  _isMounted: boolean = false;

  constructor(routeProps: RouteComponentProps<ServiceGraphPageProps>) {
    super(routeProps);

    const { graphDuration, graphLayout, badgeStatus } = this.parseProps(routeProps.location.search);
    this.state = {
      isLoading: false,
      isReady: false,
      alertVisible: false,
      alertDetails: {},
      summaryData: { summaryType: 'graph' },
      graphTimestamp: new Date().toLocaleString(),
      graphData: EMPTY_GRAPH_DATA,
      params: {
        namespace: { name: routeProps.match.params.namespace },
        graphDuration: graphDuration,
        graphLayout: graphLayout,
        badgeStatus: badgeStatus
      }
    };
  }

  parseProps = (queryString: string) => {
    const urlParams = new URLSearchParams(queryString);
    // TODO: [KIALI-357] validate `duration`
    const duration = urlParams.get('duration');
    const hideCBs = urlParams.get('hideCBs') === 'true';

    return {
      graphDuration: duration ? { value: duration } : { value: DEFAULT_DURATION },
      graphLayout: LayoutDictionary.getLayout({ name: urlParams.get('layout') }),
      badgeStatus: { hideCBs: hideCBs }
    };
  };

  componentDidMount() {
    this._isMounted = true;
    this.loadGraphDataFromBackend();
  }

  componentWillReceiveProps(nextProps: RouteComponentProps<ServiceGraphPageProps>) {
    const nextNamespace = { name: nextProps.match.params.namespace };
    const { graphDuration: nextDuration, graphLayout: nextLayout, badgeStatus: nextBadgeStatus } = this.parseProps(
      nextProps.location.search
    );

    const layoutHasChanged = nextLayout.name !== this.state.params.graphLayout.name;
    const namespaceHasChanged = nextNamespace.name !== this.state.params.namespace.name;
    const durationHasChanged = nextDuration.value !== this.state.params.graphDuration.value;
    const badgeStatusHasChanged = nextBadgeStatus !== this.state.params.badgeStatus;

    if (layoutHasChanged || namespaceHasChanged || durationHasChanged || badgeStatusHasChanged) {
      const newParams = {
        namespace: nextNamespace,
        graphDuration: nextDuration,
        graphLayout: nextLayout,
        badgeStatus: nextBadgeStatus
      };
      this.setState({ params: newParams });

      if (!layoutHasChanged) {
        // we need to explicitly provide namespace and duration because
        // the above setState() is async.
        this.loadGraphDataFromBackend(nextNamespace, nextDuration);
      }
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  handleError = (error: string) => {
    this.setState({
      alertVisible: true,
      alertDetails: { ...this.state.alertDetails, namespaceAlert: error }
    });
  };

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
    return (
      <PfContainerNavVertical>
        <PfHeader>
          <h2>Service Graph</h2>
          <PfAlerts
            alerts={this.buildAlertsArray()}
            isVisible={this.state.alertVisible}
            onDismiss={this.dismissAlert}
          />
          <GraphFilter
            disabled={this.state.isLoading}
            onLayoutChange={this.handleLayoutChange}
            onFilterChange={this.handleFilterChange}
            onNamespaceChange={this.handleNamespaceChange}
            onBadgeStatusChange={this.handleBadgeStatusChange}
            onRefresh={this.handleRefreshClick}
            onError={this.handleError}
            activeNamespace={this.state.params.namespace}
            activeLayout={this.state.params.graphLayout}
            activeDuration={this.state.params.graphDuration}
            activeBadgeStatus={this.state.params.badgeStatus}
          />
        </PfHeader>
        <div style={{ position: 'relative' }}>
          <CytoscapeLayout
            {...this.state.params}
            isLoading={this.state.isLoading}
            isReady={this.state.isReady}
            elements={this.state.graphData}
            onClick={this.handleGraphClick}
            onReady={this.handleReady}
            refresh={this.handleRefreshClick}
          />
          <SummaryPanel
            data={this.state.summaryData}
            namespace={this.state.params.namespace.name}
            queryTime={this.state.graphTimestamp}
            duration={this.state.params.graphDuration.value}
            {...computePrometheusQueryInterval(this.state.params.graphDuration.value, NUMBER_OF_DATAPOINTS)}
          />
        </div>
      </PfContainerNavVertical>
    );
  }

  handleLayoutChange = (newLayout: Layout) => {
    this.navigate(
      this.makeUrlFrom(
        this.state.params.namespace,
        newLayout,
        this.state.params.graphDuration,
        this.state.params.badgeStatus
      )
    );
  };

  handleFilterChange = (newDuration: Duration) => {
    this.navigate(
      this.makeUrlFrom(
        this.state.params.namespace,
        this.state.params.graphLayout,
        newDuration,
        this.state.params.badgeStatus
      )
    );
  };

  handleNamespaceChange = (newNS: Namespace) => {
    this.navigate(
      this.makeUrlFrom(
        newNS,
        this.state.params.graphLayout,
        this.state.params.graphDuration,
        this.state.params.badgeStatus
      )
    );
  };

  handleBadgeStatusChange = (newBS: BadgeStatus) => {
    this.navigate(
      this.makeUrlFrom(
        this.state.params.namespace,
        this.state.params.graphLayout,
        this.state.params.graphDuration,
        newBS
      )
    );
  };

  makeUrlFrom = (_namespace: Namespace, _layout: Layout, _duration: Duration, _badgeStatus: BadgeStatus) =>
    `/service-graph/${_namespace.name}?layout=${_layout.name}&duration=${_duration.value}&hideCBs=${
      _badgeStatus.hideCBs
    }`;

  /** Update browser address bar  */
  navigate = newUrl => this.context.router.history.push(newUrl);

  /** Fetch graph data */
  loadGraphDataFromBackend = (namespace?: Namespace, graphDuration?: Duration) => {
    this.setState({ isLoading: true, isReady: false });
    namespace = namespace ? namespace : this.state.params.namespace;
    const duration = graphDuration ? graphDuration.value : this.state.params.graphDuration.value;
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
