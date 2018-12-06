import * as React from 'react';
import RateTable from '../../components/SummaryPanel/RateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import { getAccumulatedTrafficRate } from '../../utils/TrafficRate';
import * as API from '../../services/Api';
import { ListPageLink, TargetPage } from '../../components/ListPage/ListPageLink';
import { Icon } from 'patternfly-react';
import { authentication } from '../../utils/Authentication';
import { shouldRefreshData, getDatapoints, mergeMetricsResponses } from './SummaryPanelCommon';
import { Response } from '../../services/Api';
import { Metrics } from '../../types/Metrics';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import MetricsOptions from 'src/types/MetricsOptions';

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
    if (this.shouldShowRPSChart()) {
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
      if (this.shouldShowRPSChart()) {
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

    return (
      <div className="panel panel-default" style={SummaryPanelGraph.panelStyle}>
        <div className="panel-heading">
          Namespace{this.props.namespaces.length > 1 ? 's' : ''}:
          {this.props.namespaces.map(namespace => (
            <ListPageLink key={namespace.name} target={TargetPage.APPLICATIONS} namespace={namespace.name}>
              {' ' + namespace.name}
            </ListPageLink>
          ))}
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
            {this.shouldShowRPSChart() && (
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

  private shouldShowRPSChart() {
    // TODO we omit the rps chart when dealing with multiple namespaces. There is no backend
    // API support to gather the data. The whole-graph chart is of nominal value, it will likely be OK.
    return this.props.namespaces.length === 1;
  }

  private updateRpsChart = (props: SummaryPanelPropType) => {
    const options: MetricsOptions = {
      filters: ['request_count', 'request_error_count'],
      queryTime: props.queryTime,
      duration: props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      direction: 'inbound',
      reporter: 'destination'
    };
    const promiseHTTP = API.getNamespaceMetrics(authentication(), props.namespaces[0].name, options);
    // TCP metrics are only available for reporter="source"
    const optionsTCP: MetricsOptions = {
      filters: ['tcp_sent', 'tcp_received'],
      queryTime: props.queryTime,
      duration: props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      direction: 'inbound',
      reporter: 'source'
    };
    const promiseTCP = API.getNamespaceMetrics(authentication(), props.namespaces[0].name, optionsTCP);
    this.metricsPromise = makeCancelablePromise(mergeMetricsResponses([promiseHTTP, promiseTCP]));

    this.metricsPromise.promise
      .then(response => {
        const reqRates = getDatapoints(response.data.metrics['request_count'], 'RPS');
        const errRates = getDatapoints(response.data.metrics['request_error_count'], 'Error');
        const tcpSent = getDatapoints(response.data.metrics['tcp_sent'], 'Sent');
        const tcpReceived = getDatapoints(response.data.metrics['tcp_received'], 'Received');

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
}
