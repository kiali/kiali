import * as React from 'react';
import { Link } from 'react-router-dom';
import RateTable from '../../components/SummaryPanel/RateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import { getAccumulatedTrafficRate } from '../../utils/TrafficRate';
import * as API from '../../services/Api';
import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { ActiveFilter } from '../../types/Filters';
import { Icon } from 'patternfly-react';
import { authentication } from '../../utils/Authentication';
import { shouldRefreshData, getDatapoints } from './SummaryPanelCommon';
import { Response } from '../../services/Api';
import { Metrics } from '../../types/Metrics';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';

type SummaryPanelGraphState = {
  loading: boolean;
  reqRates: [string, number][] | null;
  errRates: [string, number][];
  tcpSent: [string, number][];
  tcpReceived: [string, number][];
  metricsLoadError: string | null;
};

export default class SummaryPanelGraph extends React.Component<SummaryPanelPropType, SummaryPanelGraphState> {
  static readonly panelStyle = {
    width: '25em',
    minWidth: '25em',
    overflowY: 'auto' as 'auto'
  };

  private metricsPromise?: CancelablePromise<Response<Metrics>>;

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = {
      loading: true,
      reqRates: null,
      errRates: [],
      tcpSent: [],
      tcpReceived: [],
      metricsLoadError: null
    };
  }

  componentDidMount() {
    if (this.props.namespace !== 'all') {
      this.updateRpsChart(this.props);
    }
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.setState({
        reqRates: null,
        loading: true
      });
    }

    if (shouldRefreshData(prevProps, this.props)) {
      // TODO (maybe) we omit the rps chart when dealing with multiple namespaces. There is no backend
      // API support to gather the data. The whole-graph chart is of nominal value, it will likely be OK.
      if (this.props.namespace !== 'all') {
        this.updateRpsChart(this.props);
      }
    }
  }

  componentWillUnmount() {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
  }

  render() {
    const cy = this.props.data.summaryTarget;
    if (!cy) {
      return null;
    }

    const baseQuery = cy
      .nodes()
      .filter('[!isGroup]')
      .filter('[!isRoot]');
    const numSvc = baseQuery.filter('[nodeType="service"]').size();
    const numWorkloads = baseQuery.filter('[nodeType="workload"]').size();
    const numApps = baseQuery.filter('[nodeType="app"]').size();
    const numEdges = cy.edges().size();
    const trafficRate = getAccumulatedTrafficRate(cy.edges());
    const appsLink = (
      <Link
        to={this.props.namespace === 'all' ? '/applications' : `/applications?namespace=${this.props.namespace}`}
        onClick={this.updateAppsFilter}
      >
        {this.props.namespace}
      </Link>
    );

    return (
      <div className="panel panel-default" style={SummaryPanelGraph.panelStyle}>
        <div className="panel-heading">
          Namespace: {appsLink}
          {this.renderTopologySummary(numSvc, numWorkloads, numApps, numEdges)}
        </div>
        <div className="panel-body">
          <div>
            <RateTable
              title="HTTP Traffic (requests per second):"
              rate={trafficRate.rate}
              rate3xx={trafficRate.rate3xx}
              rate4xx={trafficRate.rate4xx}
              rate5xx={trafficRate.rate5xx}
            />
            {this.props.namespace !== 'all' && (
              <div>
                <hr />
                {this.renderRpsChart()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  private updateRpsChart = (props: SummaryPanelPropType) => {
    const options = {
      queryTime: props.queryTime,
      duration: props.duration,
      step: props.step,
      rateInterval: props.rateInterval
    };
    const promise = API.getNamespaceMetrics(authentication(), props.namespace, options);
    this.metricsPromise = makeCancelablePromise(promise);

    this.metricsPromise.promise
      .then(response => {
        let metrics = response.data.dest.metrics;
        const reqRates = getDatapoints(metrics['request_count_in'], 'RPS');
        const errRates = getDatapoints(metrics['request_error_count_in'], 'Error');

        // TCP metrics are only available for reporter="source"
        metrics = response.data.source.metrics;
        const tcpSent = getDatapoints(metrics['tcp_sent_in'], 'Sent');
        const tcpReceived = getDatapoints(metrics['tcp_received_in'], 'Received');

        this.setState({
          loading: false,
          reqRates: reqRates,
          errRates: errRates,
          tcpSent: tcpSent,
          tcpReceived: tcpReceived
        });
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('SummaryPanelGraph: Ignore fetch error (canceled).');
          return;
        }
        const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
        this.setState({
          loading: false,
          metricsLoadError: errorMsg,
          reqRates: null
        });
      });

    this.setState({ loading: true, metricsLoadError: null });
  };

  private renderTopologySummary = (numSvc: number, numWorkloads: number, numApps: number, numEdges: number) => (
    <div>
      {numApps > 0 && (
        <>
          <Icon name="applications" type="pf" style={{ padding: '0 1em' }} />
          {numApps.toString()} {numApps === 1 ? 'app' : 'apps'}
          <br />
        </>
      )}
      {numSvc > 0 && (
        <>
          <Icon name="service" type="pf" style={{ padding: '0 1em' }} />
          {numSvc.toString()} {numSvc === 1 ? 'service' : 'services'}
          <br />
        </>
      )}
      {numWorkloads > 0 && (
        <>
          <Icon name="bundle" type="pf" style={{ padding: '0 1em' }} />
          {numWorkloads.toString()} {numWorkloads === 1 ? 'workload' : 'workloads'}
          <br />
        </>
      )}
      {numEdges > 0 && (
        <>
          <Icon name="topology" type="pf" style={{ padding: '0 1em' }} />
          {numEdges.toString()} {numEdges === 1 ? 'link' : 'links'}
        </>
      )}
    </div>
  );

  private renderRpsChart = () => {
    if (this.state.loading && !this.state.reqRates) {
      return <strong>Loading chart...</strong>;
    } else if (this.state.metricsLoadError) {
      return (
        <div>
          <Icon type="pf" name="warning-triangle-o" /> <strong>Error loading metrics: </strong>
          {this.state.metricsLoadError}
        </div>
      );
    }

    return (
      <>
        <RpsChart
          label="HTTP - Total Request Traffic"
          dataRps={this.state.reqRates!}
          dataErrors={this.state.errRates}
        />
        <TcpChart label="TCP - Total Traffic" receivedRates={this.state.tcpReceived} sentRates={this.state.tcpSent} />
      </>
    );
  };

  private updateAppsFilter = () => {
    let filters: ActiveFilter[] = [];
    if (this.props.namespace !== 'all') {
      let activeFilter: ActiveFilter = {
        category: 'Namespace',
        value: this.props.namespace.toString()
      };
      filters = [activeFilter];
    }
    FilterSelected.setSelected(filters);
  };
}
