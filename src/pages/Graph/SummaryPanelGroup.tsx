import * as React from 'react';
import { InOutRateTableGrpc, InOutRateTableHttp } from '../../components/SummaryPanel/InOutRateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import { getAccumulatedTrafficRateGrpc, getAccumulatedTrafficRateHttp } from '../../utils/TrafficRate';
import { renderBadgedLink, renderHealth } from './SummaryLink';
import {
  shouldRefreshData,
  updateHealth,
  getFirstDatapoints,
  getNodeMetrics,
  getNodeMetricType,
  renderNoTraffic,
  summaryHeader,
  hr,
  summaryPanel
} from './SummaryPanelCommon';
import { Health } from '../../types/Health';
import { Response } from '../../services/Api';
import { Metrics, Datapoint } from '../../types/Metrics';
import { Reporter } from '../../types/MetricsOptions';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { KialiIcon } from 'config/KialiIcon';
import { decoratedNodeData, CyNode } from 'components/CytoscapeGraph/CytoscapeGraphUtils';
import { Dropdown, DropdownPosition, DropdownItem, KebabToggle } from '@patternfly/react-core';
import { getOptions, clickHandler } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';

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
  isOpen: boolean;
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
  isOpen: false,
  loading: false,
  healthLoading: false,
  metricsLoadError: null,
  ...defaultMetricsState
};

export default class SummaryPanelGroup extends React.Component<SummaryPanelPropType, SummaryPanelGroupState> {
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
    const serviceList = this.renderServiceList(group);
    const workloadList = this.renderWorkloadList(group);

    const actions = getOptions(nodeData, true, false, '').map(o => {
      return (
        <DropdownItem key={o.text} onClick={() => clickHandler(o)}>
          {o.text}
        </DropdownItem>
      );
    });

    return (
      <div ref={this.mainDivRef} className={`panel panel-default ${summaryPanel}`}>
        <div className="panel-heading" style={summaryHeader}>
          <div>
            {renderBadgedLink(nodeData)}
            <Dropdown
              id="summary-group-actions"
              isPlain={true}
              style={{ float: 'right' }}
              dropdownItems={actions}
              isOpen={this.state.isOpen}
              position={DropdownPosition.right}
              toggle={<KebabToggle id="summary-group-kebab" onToggle={this.onToggleActions} />}
            />
          </div>
          <div>{renderHealth(this.state.health)}</div>
          <div>
            {this.renderBadgeSummary(group)}
            {serviceList.length > 0 && <div>{serviceList}</div>}
            {workloadList.length > 0 && <div> {workloadList}</div>}
          </div>
        </div>
        <div className="panel-body">
          {this.hasGrpcTraffic(group) && (
            <>
              {this.renderGrpcRates(group)}
              {hr()}
            </>
          )}
          {this.hasHttpTraffic(group) && (
            <>
              {this.renderHttpRates(group)}
              {hr()}
            </>
          )}
          <div>
            {this.renderSparklines(group)}
            {hr()}
          </div>
          {!this.hasGrpcTraffic(group) && renderNoTraffic('GRPC')}
          {!this.hasHttpTraffic(group) && renderNoTraffic('HTTP')}
        </div>
      </div>
    );
  }

  private onToggleActions = isExpanded => {
    this.setState({ isOpen: isExpanded });
  };

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
      <div style={{ marginTop: '10px', marginBottom: '10px' }}>
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
      </div>
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

    group.children(`node[nodeType = "${NodeType.SERVICE}"]`).forEach(node => {
      const nodeData = decoratedNodeData(node);
      serviceList.push(renderBadgedLink(nodeData, NodeType.SERVICE));
    });

    return serviceList;
  };

  private renderWorkloadList = (group): any[] => {
    const workloadList: any[] = [];

    group.children('node[workload]').forEach(node => {
      const nodeData = decoratedNodeData(node);
      workloadList.push(renderBadgedLink(nodeData, NodeType.WORKLOAD));
    });

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
