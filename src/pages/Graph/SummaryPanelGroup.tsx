import * as React from 'react';
import { Icon } from 'patternfly-react';

import { InOutRateTableGrpc, InOutRateTableHttp } from '../../components/SummaryPanel/InOutRateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import graphUtils from '../../utils/Graphing';
import { getAccumulatedTrafficRateGrpc, getAccumulatedTrafficRateHttp } from '../../utils/TrafficRate';
import { RenderLink, renderTitle } from './SummaryLink';
import {
  shouldRefreshData,
  updateHealth,
  nodeData,
  getNodeMetrics,
  getNodeMetricType,
  renderNoTraffic
} from './SummaryPanelCommon';
import { DisplayMode, HealthIndicator } from '../../components/Health/HealthIndicator';
import Label from '../../components/Label/Label';
import { Health } from '../../types/Health';
import { Response } from '../../services/Api';
import { Metrics } from '../../types/Metrics';
import { Reporter } from '../../types/MetricsOptions';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { serverConfig } from '../../config/ServerConfig';
import { CyNode } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { icons } from '../../config';

type SummaryPanelGroupState = {
  loading: boolean;
  requestCountIn: [string | number][] | null;
  requestCountOut: [string | number][];
  errorCountIn: [string | number][];
  errorCountOut: [string | number][];
  tcpSentIn: [string | number][];
  tcpSentOut: [string | number][];
  tcpReceivedIn: [string | number][];
  tcpReceivedOut: [string | number][];
  healthLoading: boolean;
  health?: Health;
  metricsLoadError: string | null;
};

export default class SummaryPanelGroup extends React.Component<SummaryPanelPropType, SummaryPanelGroupState> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: '25em',
    overflowY: 'auto' as 'auto',
    width: '25em'
  };

  private metricsPromise?: CancelablePromise<Response<Metrics>[]>;
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelPropType) {
    super(props);
    this.state = {
      loading: true,
      requestCountIn: null,
      requestCountOut: [],
      errorCountIn: [],
      errorCountOut: [],
      tcpSentIn: [],
      tcpSentOut: [],
      tcpReceivedIn: [],
      tcpReceivedOut: [],
      healthLoading: false,
      metricsLoadError: null
    };

    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    this.updateRpsCharts(this.props);
    updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.setState({
        requestCountIn: null,
        loading: true
      });
      if (this.mainDivRef.current) {
        this.mainDivRef.current.scrollTop = 0;
      }
    }
    if (shouldRefreshData(prevProps, this.props)) {
      this.updateRpsCharts(this.props);
      updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
    }
  }

  componentWillUnmount() {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
  }

  render() {
    const group = this.props.data.summaryTarget;
    const data = nodeData(group);
    const { namespace } = data;
    const serviceList = this.renderServiceList(group);
    const workloadList = this.renderWorkloadList(group);

    return (
      <div ref={this.mainDivRef} className="panel panel-default" style={SummaryPanelGroup.panelStyle}>
        <div className="panel-heading">
          {this.state.healthLoading ? (
            // Remove glitch while health is being reloaded
            <span style={{ width: 18, height: 17, display: 'inline-block' }} />
          ) : (
            this.state.health && (
              <HealthIndicator
                id="graph-health-indicator"
                mode={DisplayMode.SMALL}
                health={this.state.health}
                tooltipPlacement="left"
              />
            )
          )}
          <span> {renderTitle(data)}</span>
          <div className="label-collection" style={{ paddingTop: '3px' }}>
            <Label name="namespace" value={namespace} key={namespace} />
            {this.renderVersionBadges()}
          </div>
          {this.renderBadgeSummary(group)}
        </div>
        <div className="panel-body">
          {serviceList.length > 0 && (
            <div>
              <strong>Services: </strong>
              {serviceList}
            </div>
          )}
          {workloadList.length > 0 && (
            <div>
              <strong>Workloads: </strong>
              {workloadList}
            </div>
          )}
          {(serviceList.length > 0 || workloadList.length > 0) && <hr />}

          {/* TODO: link to App Details charts when available
           <p style={{ textAlign: 'right' }}>
            <Link to={`/namespaces/${namespace}/services/${app}?tab=metrics&groupings=local+version%2Cresponse+code`}>
              View detailed charts <Icon name="angle-double-right" />
            </Link>
          </p> */}
          {this.hasGrpcTraffic(group) ? this.renderGrpcRates(group) : renderNoTraffic('GRPC')}
          {this.hasHttpTraffic(group) ? this.renderHttpRates(group) : renderNoTraffic('HTTP')}
          <div>{this.renderSparklines(group)}</div>
        </div>
      </div>
    );
  }

  private updateRpsCharts = (props: SummaryPanelPropType) => {
    const target = props.data.summaryTarget;
    const data = nodeData(target);
    const nodeMetricType = getNodeMetricType(data);

    if (this.metricsPromise) {
      this.metricsPromise.cancel();
      this.metricsPromise = undefined;
    }

    if (!this.hasGrpcTraffic(target) && !this.hasHttpTraffic(target) && !this.hasTcpTraffic(target)) {
      this.setState({ loading: false });
      return;
    }

    const filters = ['request_count', 'request_error_count', 'tcp_sent', 'tcp_received'];
    const reporter: Reporter =
      this.props.data.summaryTarget.namespace === serverConfig.istioNamespace ? 'destination' : 'source';

    const promiseOut = getNodeMetrics(nodeMetricType, target, props, filters, 'outbound', reporter);
    // use dest metrics for incoming
    const promiseIn = getNodeMetrics(nodeMetricType, target, props, filters, 'inbound', 'destination');
    this.metricsPromise = makeCancelablePromise(Promise.all([promiseOut, promiseIn]));

    this.metricsPromise.promise
      .then(responses => {
        const metricsOut = responses[0].data.metrics;
        const metricsIn = responses[1].data.metrics;
        const rcOut = metricsOut.request_count;
        const ecOut = metricsOut.request_error_count;
        const tcpSentOut = metricsOut.tcp_sent;
        const tcpReceivedOut = metricsOut.tcp_received;
        const rcIn = metricsIn.request_count;
        const ecIn = metricsIn.request_error_count;
        const tcpSentIn = metricsIn.tcp_sent;
        const tcpReceivedIn = metricsIn.tcp_received;
        this.setState({
          loading: false,
          requestCountIn: graphUtils.toC3Columns(rcIn.matrix, 'RPS'),
          errorCountIn: graphUtils.toC3Columns(ecIn.matrix, 'Error'),
          requestCountOut: graphUtils.toC3Columns(rcOut.matrix, 'RPS'),
          errorCountOut: graphUtils.toC3Columns(ecOut.matrix, 'Error'),
          tcpSentOut: graphUtils.toC3Columns(tcpSentOut.matrix, 'Sent'),
          tcpReceivedOut: graphUtils.toC3Columns(tcpReceivedOut.matrix, 'Received'),
          tcpSentIn: graphUtils.toC3Columns(tcpSentIn.matrix, 'Sent'),
          tcpReceivedIn: graphUtils.toC3Columns(tcpReceivedIn.matrix, 'Received')
        });
      })
      .catch(error => {
        if (error.isCanceled) {
          console.log('SummaryPanelGroup: Ignore fetch error (canceled).');
          return;
        }
        const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
        this.setState({
          loading: false,
          metricsLoadError: errorMsg,
          requestCountIn: null
        });
      });

    this.setState({ loading: true, metricsLoadError: null });
  };

  private renderVersionBadges = () => {
    return this.props.data.summaryTarget
      .children(`node[${CyNode.version}]`)
      .toArray()
      .map((c, _i) => (
        <Label
          key={c.data(CyNode.version)}
          name={serverConfig.istioLabels.versionLabelName}
          value={c.data(CyNode.version)}
        />
      ));
  };

  private renderBadgeSummary = group => {
    let hasCB: boolean = group.data(CyNode.hasCB) === true;
    let hasVS: boolean = group.data(CyNode.hasVS) === true;

    group
      .children(`node[${CyNode.hasCB}],[${CyNode.hasVS}]`)
      .nodes()
      .forEach(n => {
        hasCB = hasCB || n.data(CyNode.hasCB);
        hasVS = hasVS || n.data(CyNode.hasVS);
      });

    return (
      <>
        {hasCB && (
          <div>
            <Icon
              name={icons.istio.circuitBreaker.name}
              type={icons.istio.circuitBreaker.type}
              style={{ width: '10px' }}
            />
            <span style={{ paddingLeft: '4px' }}>Has Circuit Breaker</span>
          </div>
        )}
        {hasVS && (
          <div>
            <Icon
              name={icons.istio.virtualService.name}
              type={icons.istio.virtualService.type}
              style={{ width: '10px' }}
            />
            <span style={{ paddingLeft: '4px' }}>Has Virtual Service</span>
          </div>
        )}
      </>
    );
  };

  private renderGrpcRates = group => {
    const nonServiceChildren = group.children('node[nodeType != "' + NodeType.SERVICE + '"]');
    const incoming = getAccumulatedTrafficRateGrpc(nonServiceChildren.incomers('edge'));
    const outgoing = getAccumulatedTrafficRateGrpc(nonServiceChildren.edgesTo('*'));

    return (
      <>
        <InOutRateTableGrpc
          title="GRPC Traffic (requests per second):"
          inRate={incoming.rate}
          inRateErr={incoming.rateErr}
          outRate={outgoing.rate}
          outRateErr={outgoing.rateErr}
        />
        <hr />
      </>
    );
  };

  private renderHttpRates = group => {
    const nonServiceChildren = group.children(`node[nodeType != "${NodeType.SERVICE}"]`);
    const incoming = getAccumulatedTrafficRateHttp(nonServiceChildren.incomers('edge'));
    const outgoing = getAccumulatedTrafficRateHttp(nonServiceChildren.edgesTo('*'));

    return (
      <>
        <InOutRateTableHttp
          title="HTTP Traffic (requests per second):"
          inRate={incoming.rate}
          inRate3xx={incoming.rate3xx}
          inRate4xx={incoming.rate4xx}
          inRate5xx={incoming.rate5xx}
          outRate={outgoing.rate}
          outRate3xx={outgoing.rate3xx}
          outRate4xx={outgoing.rate4xx}
          outRate5xx={outgoing.rate5xx}
        />
        <hr />
      </>
    );
  };

  private renderSparklines = group => {
    if (this.state.loading && !this.state.requestCountIn) {
      return <strong>Loading charts...</strong>;
    } else if (this.state.metricsLoadError) {
      return (
        <div>
          <Icon type="pf" name="warning-triangle-o" /> <strong>Error loading metrics: </strong>
          {this.state.metricsLoadError}
        </div>
      );
    }

    let tcpCharts, httpCharts;
    if (this.hasHttpTraffic(group)) {
      httpCharts = (
        <>
          <RpsChart
            key="http-inbound-request"
            label="HTTP - Inbound Request Traffic"
            dataRps={this.state.requestCountIn!}
            dataErrors={this.state.errorCountIn}
          />
          <RpsChart
            key="http-outbound-request"
            label="HTTP - Outbound Request Traffic"
            dataRps={this.state.requestCountOut}
            dataErrors={this.state.errorCountOut}
          />
          <hr />
        </>
      );
    }

    if (this.hasTcpTraffic(group)) {
      tcpCharts = (
        <>
          <TcpChart
            key="tcp-inbound-request"
            label="TCP - Inbound Traffic"
            receivedRates={this.state.tcpReceivedIn}
            sentRates={this.state.tcpSentIn}
          />
          <TcpChart
            key="tcp-outbound-request"
            label="TCP - Outbound Traffic"
            receivedRates={this.state.tcpReceivedOut}
            sentRates={this.state.tcpSentOut}
          />
          <hr />
        </>
      );
    }

    return (
      <>
        {httpCharts}
        {tcpCharts}
      </>
    );
  };

  private renderServiceList = (group): any[] => {
    // likely 0 or 1 but support N in case of unanticipated labeling
    const serviceList: any[] = [];

    group.children(`node[nodeType = "${NodeType.SERVICE}"]`).forEach((node, index) => {
      const data = nodeData(node);
      serviceList.push(<RenderLink key={`node-${index}`} data={data} nodeType={NodeType.SERVICE} />);
      serviceList.push(<span key={`node-comma-${index}`}>, </span>);
    });

    if (serviceList.length > 0) {
      serviceList.pop();
    }

    return serviceList;
  };

  private renderWorkloadList = (group): any[] => {
    const workloadList: any[] = [];

    group.children('node[workload]').forEach((node, index) => {
      const data = nodeData(node);
      workloadList.push(<RenderLink key={`node-${index}`} data={data} nodeType={NodeType.WORKLOAD} />);
      workloadList.push(<span key={`node-comma-${index}`}>, </span>);
    });

    if (workloadList.length > 0) {
      workloadList.pop();
    }

    return workloadList;
  };

  private hasGrpcTraffic = (group): boolean => {
    if (
      group
        .children()
        .filter('[grpcIn > 0],[grpcOut > 0]')
        .size() > 0
    ) {
      return true;
    }
    return false;
  };

  private hasHttpTraffic = (group): boolean => {
    if (
      group
        .children()
        .filter('[httpIn > 0],[httpOut > 0]')
        .size() > 0
    ) {
      return true;
    }
    return false;
  };

  private hasTcpTraffic = (group): boolean => {
    if (
      group
        .children()
        .filter('[tcpIn > 0],[tcpOut > 0]')
        .size() > 0
    ) {
      return true;
    }
    return false;
  };
}
