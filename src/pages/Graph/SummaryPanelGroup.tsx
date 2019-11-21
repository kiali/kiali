import * as React from 'react';
import { Badge } from '@patternfly/react-core';
import { InOutRateTableGrpc, InOutRateTableHttp } from '../../components/SummaryPanel/InOutRateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import { getAccumulatedTrafficRateGrpc, getAccumulatedTrafficRateHttp } from '../../utils/TrafficRate';
import { RenderLink, renderTitle } from './SummaryLink';
import {
  shouldRefreshData,
  updateHealth,
  getFirstDatapoints,
  getNodeMetrics,
  getNodeMetricType,
  renderNoTraffic,
  summaryHeader,
  summaryLabels
} from './SummaryPanelCommon';
import { Health } from '../../types/Health';
import { Response } from '../../services/Api';
import { Metrics, Datapoint } from '../../types/Metrics';
import { Reporter } from '../../types/MetricsOptions';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { serverConfig } from '../../config/ServerConfig';
import { CyNode, decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';

type SummaryPanelGroupMetricsState = {
  requestCountIn: Datapoint[];
  requestCountOut: Datapoint[];
  errorCountIn: Datapoint[];
  errorCountOut: Datapoint[];
  tcpSentIn: Datapoint[];
  tcpSentOut: Datapoint[];
  tcpReceivedIn: Datapoint[];
  tcpReceivedOut: Datapoint[];
};

type SummaryPanelGroupState = SummaryPanelGroupMetricsState & {
  group: any;
  loading: boolean;
  healthLoading: boolean;
  health?: Health;
  metricsLoadError: string | null;
};

const defaultMetricsState: SummaryPanelGroupMetricsState = {
  requestCountIn: [],
  requestCountOut: [],
  errorCountIn: [],
  errorCountOut: [],
  tcpSentIn: [],
  tcpSentOut: [],
  tcpReceivedIn: [],
  tcpReceivedOut: []
};

const defaultState: SummaryPanelGroupState = {
  group: null,
  loading: false,
  healthLoading: false,
  metricsLoadError: null,
  ...defaultMetricsState
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
    this.state = { ...defaultState };

    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  static getDerivedStateFromProps(props: SummaryPanelPropType, state: SummaryPanelGroupState) {
    // if the summaryTarget (i.e. selected group) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.data.summaryTarget !== state.group
      ? { group: props.data.summaryTarget, loading: true, ...defaultMetricsState }
      : null;
  }

  componentDidMount() {
    this.updateRpsCharts(this.props);
    updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
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
    const nodeData = decoratedNodeData(group);
    const { namespace } = nodeData;
    const serviceList = this.renderServiceList(group);
    const workloadList = this.renderWorkloadList(group);

    return (
      <div ref={this.mainDivRef} className="panel panel-default" style={SummaryPanelGroup.panelStyle}>
        <div className={`panel-heading ${summaryHeader}`}>
          {renderTitle(nodeData, this.state.health)}
          <div className={`label-collection ${summaryLabels}`}>
            <Badge>namespace: {namespace}</Badge>
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
              View detailed charts <KialiIcon.AngleDoubleRight />
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
    const nodeData = decoratedNodeData(target);
    const nodeMetricType = getNodeMetricType(nodeData);

    if (this.metricsPromise) {
      this.metricsPromise.cancel();
      this.metricsPromise = undefined;
    }

    if (!this.hasGrpcTraffic(target) && !this.hasHttpTraffic(target) && !this.hasTcpTraffic(target)) {
      this.setState({ loading: false });
      return;
    }

    const filters = ['request_count', 'request_error_count', 'tcp_sent', 'tcp_received'];
    const reporter: Reporter = nodeData.isIstio ? 'destination' : 'source';

    const promiseOut = getNodeMetrics(nodeMetricType, target, props, filters, 'outbound', reporter);
    // use dest metrics for incoming
    const promiseIn = getNodeMetrics(nodeMetricType, target, props, filters, 'inbound', 'destination');
    this.metricsPromise = makeCancelablePromise(Promise.all([promiseOut, promiseIn]));

    this.metricsPromise.promise
      .then((responses: Response<Metrics>[]) => {
        const metricsOut = responses[0].data.metrics;
        const metricsIn = responses[1].data.metrics;
        this.setState({
          loading: false,
          requestCountIn: getFirstDatapoints(metricsIn.request_count),
          errorCountIn: getFirstDatapoints(metricsIn.request_error_count),
          requestCountOut: getFirstDatapoints(metricsOut.request_count),
          errorCountOut: getFirstDatapoints(metricsOut.request_error_count),
          tcpSentOut: getFirstDatapoints(metricsOut.tcp_sent),
          tcpReceivedOut: getFirstDatapoints(metricsOut.tcp_received),
          tcpSentIn: getFirstDatapoints(metricsIn.tcp_sent),
          tcpReceivedIn: getFirstDatapoints(metricsIn.tcp_received)
        });
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('SummaryPanelGroup: Ignore fetch error (canceled).');
          return;
        }
        const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
        this.setState({
          loading: false,
          metricsLoadError: errorMsg,
          ...defaultMetricsState
        });
      });

    this.setState({ loading: true, metricsLoadError: null });
  };

  private renderVersionBadges = () => {
    const versions = this.props.data.summaryTarget.children(`node[${CyNode.version}]`).toArray();
    return (
      <>
        {versions.length > 0 && <br />}
        {versions.map((c, _i) => (
          <Badge style={{ marginTop: '2px', marginRight: '1px' }}>
            {serverConfig.istioLabels.versionLabelName}: value={c.data(CyNode.version)}
          </Badge>
        ))}
      </>
    );
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
            <KialiIcon.CircuitBreaker />
            <span style={{ paddingLeft: '4px' }}>Has Circuit Breaker</span>
          </div>
        )}
        {hasVS && (
          <div>
            <KialiIcon.VirtualService />
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
          title="HTTP (requests per second):"
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
    if (this.state.loading) {
      return <strong>Loading charts...</strong>;
    } else if (this.state.metricsLoadError) {
      return (
        <div>
          <KialiIcon.Warning /> <strong>Error loading metrics: </strong>
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
      const nodeData = decoratedNodeData(node);
      serviceList.push(<RenderLink key={`node-${index}`} nodeData={nodeData} nodeType={NodeType.SERVICE} />);
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
      const nodeData = decoratedNodeData(node);
      workloadList.push(<RenderLink key={`node-${index}`} nodeData={nodeData} nodeType={NodeType.WORKLOAD} />);
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
