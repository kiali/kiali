import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon, Nav, NavItem, TabContainer, TabContent, TabPane } from 'patternfly-react';
import { RateTableGrpc, RateTableHttp } from '../../components/SummaryPanel/RateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType, NodeType } from '../../types/Graph';
import { getAccumulatedTrafficRateGrpc, getAccumulatedTrafficRateHttp } from '../../utils/TrafficRate';
import * as API from '../../services/Api';
import {
  shouldRefreshData,
  getFirstDatapoints,
  mergeMetricsResponses,
  summaryBodyTabs,
  summaryNavTabs
} from './SummaryPanelCommon';
import { Response } from '../../services/Api';
import { Metrics, Datapoint } from '../../types/Metrics';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { Paths } from '../../config';
import { CyNode } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';

type SummaryPanelGraphState = {
  loading: boolean;
  reqRates: Datapoint[] | null;
  errRates: Datapoint[];
  tcpSent: Datapoint[];
  tcpReceived: Datapoint[];
  metricsLoadError: string | null;
};

export default class SummaryPanelGraph extends React.Component<SummaryPanelPropType, SummaryPanelGraphState> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: '25em',
    overflowY: 'auto' as 'auto',
    width: '25em'
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

    const numSvc = cy.$(`node[nodeType = "${NodeType.SERVICE}"]`).size();
    const numWorkloads = cy.$(`node[nodeType = "${NodeType.WORKLOAD}"]`).size();
    const { numApps, numVersions } = this.countApps(cy);
    const numEdges = cy.edges().size();
    // when getting accumulated traffic rates don't count requests from injected service nodes
    const nonServiceEdges = cy.$(`node[nodeType != "${NodeType.SERVICE}"][!isGroup]`).edgesTo('*');
    const totalRateGrpc = getAccumulatedTrafficRateGrpc(nonServiceEdges);
    const totalRateHttp = getAccumulatedTrafficRateHttp(nonServiceEdges);
    const incomingEdges = cy.$(`node[?${CyNode.isRoot}]`).edgesTo('*');
    const incomingRateGrpc = getAccumulatedTrafficRateGrpc(incomingEdges);
    const incomingRateHttp = getAccumulatedTrafficRateHttp(incomingEdges);
    const outgoingEdges = cy
      .nodes()
      .leaves(`node[?${CyNode.isOutside}],[?${CyNode.isServiceEntry}]`)
      .connectedEdges();
    const outgoingRateGrpc = getAccumulatedTrafficRateGrpc(outgoingEdges);
    const outgoingRateHttp = getAccumulatedTrafficRateHttp(outgoingEdges);

    return (
      <div className="panel panel-default" style={SummaryPanelGraph.panelStyle}>
        <div className="panel-heading">
          <strong>Namespace{this.props.namespaces.length > 1 ? 's' : ''}: </strong>
          {this.props.namespaces.map(namespace => namespace.name).join(', ')}
          {this.renderTopologySummary(numSvc, numWorkloads, numApps, numVersions, numEdges)}
        </div>
        <div className={`"panel-body ${summaryBodyTabs}`}>
          <TabContainer id="basic-tabs" defaultActiveKey="incoming">
            <div>
              <Nav className={`nav nav-tabs nav-tabs-pf ${summaryNavTabs}`}>
                <NavItem eventKey="incoming">
                  <div>Incoming </div>
                </NavItem>
                <NavItem eventKey="outgoing">
                  <div>Outgoing </div>
                </NavItem>
                <NavItem eventKey="total">
                  <div>Total</div>
                </NavItem>
              </Nav>
              <TabContent style={{ paddingTop: '10px' }}>
                <TabPane eventKey="incoming" mountOnEnter={true} unmountOnExit={true}>
                  <>
                    {incomingRateGrpc.rate === 0 && incomingRateHttp.rate === 0 && (
                      <>
                        <Icon type="pf" name="info" /> No incoming traffic.
                      </>
                    )}
                    {incomingRateGrpc.rate > 0 && (
                      <RateTableGrpc
                        title="GRPC Traffic (requests per second):"
                        rate={incomingRateGrpc.rate}
                        rateErr={incomingRateGrpc.rateErr}
                      />
                    )}
                    {incomingRateHttp.rate > 0 && (
                      <RateTableHttp
                        title="HTTP Traffic (requests per second):"
                        rate={incomingRateHttp.rate}
                        rate3xx={incomingRateHttp.rate3xx}
                        rate4xx={incomingRateHttp.rate4xx}
                        rate5xx={incomingRateHttp.rate5xx}
                      />
                    )}
                    {
                      // We don't show a sparkline here because we need to aggregate the traffic of an
                      // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                    }
                  </>
                </TabPane>
                <TabPane eventKey="outgoing" mountOnEnter={true} unmountOnExit={true}>
                  <>
                    {outgoingRateGrpc.rate === 0 && outgoingRateHttp.rate === 0 && (
                      <>
                        <Icon type="pf" name="info" /> No outgoing traffic.
                      </>
                    )}
                    {outgoingRateGrpc.rate > 0 && (
                      <RateTableGrpc
                        title="GRPC Traffic (requests per second):"
                        rate={outgoingRateGrpc.rate}
                        rateErr={outgoingRateGrpc.rateErr}
                      />
                    )}
                    {outgoingRateHttp.rate > 0 && (
                      <RateTableHttp
                        title="HTTP Traffic (requests per second):"
                        rate={outgoingRateHttp.rate}
                        rate3xx={outgoingRateHttp.rate3xx}
                        rate4xx={outgoingRateHttp.rate4xx}
                        rate5xx={outgoingRateHttp.rate5xx}
                      />
                    )}
                    {
                      // We don't show a sparkline here because we need to aggregate the traffic of an
                      // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                    }
                  </>
                </TabPane>
                <TabPane eventKey="total" mountOnEnter={true} unmountOnExit={true}>
                  <>
                    {totalRateGrpc.rate === 0 && totalRateHttp.rate === 0 && (
                      <>
                        <Icon type="pf" name="info" /> No traffic.
                      </>
                    )}
                    {totalRateGrpc.rate > 0 && (
                      <RateTableGrpc
                        title="GRPC Traffic (requests per second):"
                        rate={totalRateGrpc.rate}
                        rateErr={totalRateGrpc.rateErr}
                      />
                    )}
                    {totalRateHttp.rate > 0 && (
                      <RateTableHttp
                        title="HTTP Traffic (requests per second):"
                        rate={totalRateHttp.rate}
                        rate3xx={totalRateHttp.rate3xx}
                        rate4xx={totalRateHttp.rate4xx}
                        rate5xx={totalRateHttp.rate5xx}
                      />
                    )}
                    {this.shouldShowRPSChart() && (
                      <div>
                        <hr />
                        {this.renderRpsChart()}
                      </div>
                    )}
                  </>
                </TabPane>
              </TabContent>
            </div>
          </TabContainer>
        </div>
      </div>
    );
  }

  private countApps = (cy): { numApps: number; numVersions: number } => {
    const appVersions: { [key: string]: Set<string> } = {};

    cy.$(`node[nodeType = "${NodeType.APP}"][!isGroup]`).forEach(node => {
      const app = node.data(CyNode.app);
      if (appVersions[app] === undefined) {
        appVersions[app] = new Set();
      }
      appVersions[app].add(node.data(CyNode.version));
    });

    return {
      numApps: Object.getOwnPropertyNames(appVersions).length,
      numVersions: Object.getOwnPropertyNames(appVersions).reduce((totalCount: number, version: string) => {
        return totalCount + appVersions[version].size;
      }, 0)
    };
  };

  private shouldShowRPSChart() {
    // TODO we omit the rps chart when dealing with multiple namespaces. There is no backend
    // API support to gather the data. The whole-graph chart is of nominal value, it will likely be OK.
    return this.props.namespaces.length === 1;
  }

  private updateRpsChart = (props: SummaryPanelPropType) => {
    const options: IstioMetricsOptions = {
      filters: ['request_count', 'request_error_count'],
      queryTime: props.queryTime,
      duration: props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      direction: 'inbound',
      reporter: 'destination'
    };
    const promiseHTTP = API.getNamespaceMetrics(props.namespaces[0].name, options);
    // TCP metrics are only available for reporter="source"
    const optionsTCP: IstioMetricsOptions = {
      filters: ['tcp_sent', 'tcp_received'],
      queryTime: props.queryTime,
      duration: props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      direction: 'inbound',
      reporter: 'source'
    };
    const promiseTCP = API.getNamespaceMetrics(props.namespaces[0].name, optionsTCP);
    this.metricsPromise = makeCancelablePromise(mergeMetricsResponses([promiseHTTP, promiseTCP]));

    this.metricsPromise.promise
      .then(response => {
        this.setState({
          loading: false,
          reqRates: getFirstDatapoints(response.data.metrics.request_count),
          errRates: getFirstDatapoints(response.data.metrics.request_error_count),
          tcpSent: getFirstDatapoints(response.data.metrics.tcp_sent),
          tcpReceived: getFirstDatapoints(response.data.metrics.tcp_received)
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

  private renderTopologySummary = (
    numSvc: number,
    numWorkloads: number,
    numApps: number,
    numVersions: number,
    numEdges: number
  ) => (
    <div>
      <Link
        key="appsLink"
        to={`/${Paths.APPLICATIONS}?namespaces=${this.props.namespaces.map(ns => ns.name).join(',')}`}
      >
        {' applications'}
      </Link>
      <Link
        key="servicesLink"
        to={`/${Paths.SERVICES}?namespaces=${this.props.namespaces.map(ns => ns.name).join(',')}`}
      >
        {', services'}
      </Link>
      <Link
        key="workloadsLink"
        to={`/${Paths.WORKLOADS}?namespaces=${this.props.namespaces.map(ns => ns.name).join(',')}`}
      >
        {', workloads'}
      </Link>
      <br />
      <br />
      <strong>Current Graph:</strong>
      <br />
      {numApps > 0 && (
        <>
          <Icon name="applications" type="pf" style={{ padding: '0 1em' }} />
          {numApps.toString()} {numApps === 1 ? 'app ' : 'apps '}
          {numVersions > 0 && `(${numVersions} versions)`}
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
          {numEdges.toString()} {numEdges === 1 ? 'edge' : 'edges'}
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
