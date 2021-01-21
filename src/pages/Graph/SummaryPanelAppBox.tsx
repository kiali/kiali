import * as React from 'react';
import { InOutRateTableGrpc, InOutRateTableHttp } from '../../components/SummaryPanel/InOutRateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import { getAccumulatedTrafficRateGrpc, getAccumulatedTrafficRateHttp } from '../../utils/TrafficRate';
import { renderBadgedLink, renderHealth } from './SummaryLink';
import {
  shouldRefreshData,
  getFirstDatapoints,
  getNodeMetrics,
  getNodeMetricType,
  renderNoTraffic,
  summaryHeader,
  hr,
  summaryPanel
} from './SummaryPanelCommon';
import { Response } from '../../services/Api';
import { IstioMetricsMap, Datapoint } from '../../types/Metrics';
import { Reporter } from '../../types/MetricsOptions';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { KialiIcon } from 'config/KialiIcon';
import { decoratedNodeData, CyNode } from 'components/CytoscapeGraph/CytoscapeGraphUtils';
import { Dropdown, DropdownPosition, DropdownItem, KebabToggle, DropdownGroup } from '@patternfly/react-core';
import { getOptions, clickHandler } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';

type SummaryPanelAppBoxMetricsState = {
  requestCountIn: Datapoint[];
  requestCountOut: Datapoint[];
  errorCountIn: Datapoint[];
  errorCountOut: Datapoint[];
  tcpSentIn: Datapoint[];
  tcpSentOut: Datapoint[];
  tcpReceivedIn: Datapoint[];
  tcpReceivedOut: Datapoint[];
};

type SummaryPanelAppBoxState = SummaryPanelAppBoxMetricsState & {
  appBox: any;
  isOpen: boolean;
  loading: boolean;
  metricsLoadError: string | null;
};

const defaultMetricsState: SummaryPanelAppBoxMetricsState = {
  requestCountIn: [],
  requestCountOut: [],
  errorCountIn: [],
  errorCountOut: [],
  tcpSentIn: [],
  tcpSentOut: [],
  tcpReceivedIn: [],
  tcpReceivedOut: []
};

const defaultState: SummaryPanelAppBoxState = {
  appBox: null,
  isOpen: false,
  loading: false,
  metricsLoadError: null,
  ...defaultMetricsState
};

export default class SummaryPanelAppBox extends React.Component<SummaryPanelPropType, SummaryPanelAppBoxState> {
  private metricsPromise?: CancelablePromise<Response<IstioMetricsMap>[]>;
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelPropType) {
    super(props);
    this.state = { ...defaultState };

    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  static getDerivedStateFromProps(props: SummaryPanelPropType, state: SummaryPanelAppBoxState) {
    // if the summaryTarget (i.e. selected appBox) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.data.summaryTarget !== state.appBox
      ? { appBox: props.data.summaryTarget, loading: true, ...defaultMetricsState }
      : null;
  }

  componentDidMount() {
    this.updateRpsCharts(this.props);
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      if (this.mainDivRef.current) {
        this.mainDivRef.current.scrollTop = 0;
      }
    }
    if (shouldRefreshData(prevProps, this.props)) {
      this.updateRpsCharts(this.props);
    }
  }

  componentWillUnmount() {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
  }

  render() {
    const appBox = this.props.data.summaryTarget;
    const nodeData = decoratedNodeData(appBox);
    const serviceList = this.renderServiceList(appBox);
    const workloadList = this.renderWorkloadList(appBox);

    const actions = [
      <DropdownGroup
        label="Show"
        className="kiali-appbox-menu"
        children={getOptions(nodeData).map(o => {
          return (
            <DropdownItem key={o.text} onClick={() => clickHandler(o)}>
              {o.text}
            </DropdownItem>
          );
        })}
      />
    ];

    return (
      <div ref={this.mainDivRef} className={`panel panel-default ${summaryPanel}`}>
        <div className="panel-heading" style={summaryHeader}>
          <div>
            {renderBadgedLink(nodeData)}
            <Dropdown
              id="summary-appbox-actions"
              isPlain={true}
              style={{ float: 'right' }}
              dropdownItems={actions}
              isOpen={this.state.isOpen}
              position={DropdownPosition.right}
              toggle={<KebabToggle id="summary-appbox-kebab" onToggle={this.onToggleActions} />}
              isGrouped={true}
            />
          </div>
          <div>{renderHealth(nodeData.health)}</div>
          <div>
            {this.renderBadgeSummary(appBox)}
            {serviceList.length > 0 && <div>{serviceList}</div>}
            {workloadList.length > 0 && <div> {workloadList}</div>}
          </div>
        </div>
        <div className="panel-body">
          {this.hasGrpcTraffic(appBox) && (
            <>
              {this.renderGrpcRates(appBox)}
              {hr()}
            </>
          )}
          {this.hasHttpTraffic(appBox) && (
            <>
              {this.renderHttpRates(appBox)}
              {hr()}
            </>
          )}
          <div>
            {this.renderSparklines(appBox)}
            {hr()}
          </div>
          {!this.hasGrpcTraffic(appBox) && renderNoTraffic('GRPC')}
          {!this.hasHttpTraffic(appBox) && renderNoTraffic('HTTP')}
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
      .then((responses: Response<IstioMetricsMap>[]) => {
        const metricsOut = responses[0].data;
        const metricsIn = responses[1].data;
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
          console.debug('SummaryPanelAppBox: Ignore fetch error (canceled).');
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

  private renderBadgeSummary = appBox => {
    let hasCB: boolean = appBox.data(CyNode.hasCB) === true;
    let hasVS: boolean = appBox.data(CyNode.hasVS) === true;

    appBox
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

  private renderGrpcRates = appBox => {
    // only consider the physical children to avoid inflated rates
    const validChildren = appBox.children(
      `node[nodeType != "${NodeType.SERVICE}"][nodeType != "${NodeType.AGGREGATE}"]`
    );
    const incoming = getAccumulatedTrafficRateGrpc(validChildren.incomers('edge'));
    const outgoing = getAccumulatedTrafficRateGrpc(validChildren.edgesTo('*'));

    return (
      <>
        <InOutRateTableGrpc
          title="GRPC Traffic (requests per second):"
          inRate={incoming.rate}
          inRateGrpcErr={incoming.rateGrpcErr}
          inRateNR={incoming.rateNoResponse}
          outRate={outgoing.rate}
          outRateGrpcErr={outgoing.rateGrpcErr}
          outRateNR={outgoing.rateNoResponse}
        />
      </>
    );
  };

  private renderHttpRates = appBox => {
    // only consider the physical children to avoid inflated rates
    const validChildren = appBox.children(
      `node[nodeType != "${NodeType.SERVICE}"][nodeType != "${NodeType.AGGREGATE}"]`
    );
    const incoming = getAccumulatedTrafficRateHttp(validChildren.incomers('edge'));
    const outgoing = getAccumulatedTrafficRateHttp(validChildren.edgesTo('*'));

    return (
      <>
        <InOutRateTableHttp
          title="HTTP (requests per second):"
          inRate={incoming.rate}
          inRate3xx={incoming.rate3xx}
          inRate4xx={incoming.rate4xx}
          inRate5xx={incoming.rate5xx}
          inRateNR={incoming.rateNoResponse}
          outRate={outgoing.rate}
          outRate3xx={outgoing.rate3xx}
          outRate4xx={outgoing.rate4xx}
          outRate5xx={outgoing.rate5xx}
          outRateNR={outgoing.rateNoResponse}
        />
      </>
    );
  };

  private renderSparklines = appBox => {
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
    if (this.hasHttpTraffic(appBox)) {
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

    if (this.hasTcpTraffic(appBox)) {
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

  private renderServiceList = (appBox): any[] => {
    // likely 0 or 1 but support N in case of unanticipated labeling
    const serviceList: any[] = [];

    appBox.children(`node[nodeType = "${NodeType.SERVICE}"]`).forEach(serviceNode => {
      const serviceNodeData = decoratedNodeData(serviceNode);
      serviceList.push(renderBadgedLink(serviceNodeData, NodeType.SERVICE));
      const aggregates = appBox.children(
        `node[nodeType = "${NodeType.AGGREGATE}"][service = "${serviceNodeData.service}"]`
      );
      if (!!aggregates && aggregates.length > 0) {
        const aggregateList: any[] = [];
        aggregates.forEach(aggregateNode => {
          const aggregateNodeData = decoratedNodeData(aggregateNode);
          aggregateList.push(renderBadgedLink(aggregateNodeData, NodeType.AGGREGATE));
        });
        serviceList.push(<div>{aggregateList}</div>);
      }
    });

    return serviceList;
  };

  private renderWorkloadList = (appBox): any[] => {
    const workloadList: any[] = [];

    appBox.children('node[workload]').forEach(node => {
      const nodeData = decoratedNodeData(node);
      workloadList.push(renderBadgedLink(nodeData, NodeType.WORKLOAD));
    });

    return workloadList;
  };

  private hasGrpcTraffic = (appBox): boolean => {
    if (appBox.children().filter('[grpcIn > 0],[grpcOut > 0]').size() > 0) {
      return true;
    }
    return false;
  };

  private hasHttpTraffic = (appBox): boolean => {
    if (appBox.children().filter('[httpIn > 0],[httpOut > 0]').size() > 0) {
      return true;
    }
    return false;
  };

  private hasTcpTraffic = (appBox): boolean => {
    if (appBox.children().filter('[tcpIn > 0],[tcpOut > 0]').size() > 0) {
      return true;
    }
    return false;
  };
}
