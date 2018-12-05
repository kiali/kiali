import * as React from 'react';
import { Icon } from 'patternfly-react';

import InOutRateTable from '../../components/SummaryPanel/InOutRateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import graphUtils from '../../utils/Graphing';
import { getAccumulatedTrafficRate } from '../../utils/TrafficRate';
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
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { serverConfig } from '../../config';
import { Reporter } from 'src/types/MetricsOptions';

type SummaryPanelGroupState = {
  loading: boolean;
  requestCountIn: [string, number][] | null;
  requestCountOut: [string, number][];
  errorCountIn: [string, number][];
  errorCountOut: [string, number][];
  tcpSentIn: [string, number][];
  tcpSentOut: [string, number][];
  tcpReceivedIn: [string, number][];
  tcpReceivedOut: [string, number][];
  healthLoading: boolean;
  health?: Health;
  metricsLoadError: string | null;
};

export default class SummaryPanelGroup extends React.Component<SummaryPanelPropType, SummaryPanelGroupState> {
  static readonly panelStyle = {
    width: '25em',
    minWidth: '25em',
    overflowY: 'auto' as 'auto'
  };

  private metricsPromise?: CancelablePromise<Response<Metrics>[]>;

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

    const workloadList = this.renderWorkloadList(group);

    return (
      <div className="panel panel-default" style={SummaryPanelGroup.panelStyle}>
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
          {this.renderBadgeSummary(group.data('hasVS'))}
        </div>
        <div className="panel-body">
          {workloadList.length > 0 && (
            <div>
              <strong>Workloads: </strong>
              {workloadList}
              <hr />
            </div>
          )}
          {/* TODO: link to App Details charts when available
           <p style={{ textAlign: 'right' }}>
            <Link to={`/namespaces/${namespace}/services/${app}?tab=metrics&groupings=local+version%2Cresponse+code`}>
              View detailed charts <Icon name="angle-double-right" />
            </Link>
          </p> */}
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

    if (!nodeMetricType || (!this.hasHttpTraffic(target) && !this.hasTcpTraffic(target))) {
      this.setState({ loading: false });
      return;
    }

    const filters = ['request_count', 'request_error_count', 'tcp_sent', 'tcp_received'];
    const reporter: Reporter =
      this.props.data.summaryTarget.namespace === serverConfig().istioNamespace ? 'destination' : 'source';

    const promiseOut = getNodeMetrics(nodeMetricType, target, props, filters, 'outbound', reporter);
    // use dest metrics for incoming
    const promiseIn = getNodeMetrics(nodeMetricType, target, props, filters, 'inbound', 'destination');
    this.metricsPromise = makeCancelablePromise(Promise.all([promiseOut, promiseIn]));

    this.metricsPromise.promise
      .then(responses => {
        const metricsOut = responses[0].data.metrics;
        const metricsIn = responses[1].data.metrics;
        const rcOut = metricsOut['request_count'];
        const ecOut = metricsOut['request_error_count'];
        const tcpSentOut = metricsOut['tcp_sent'];
        const tcpReceivedOut = metricsOut['tcp_received'];
        const rcIn = metricsIn['request_count'];
        const ecIn = metricsIn['request_error_count'];
        const tcpSentIn = metricsIn['tcp_sent'];
        const tcpReceivedIn = metricsIn['tcp_received'];
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
      .children()
      .toArray()
      .map((c, i) => (
        <Label
          key={c.data('version')}
          name={serverConfig().istioLabels['VersionLabelName']}
          value={c.data('version')}
        />
      ));
  };

  private renderBadgeSummary = (hasVS: boolean) => {
    return (
      <>
        {hasVS && (
          <div>
            <Icon name="code-fork" type="fa" style={{ width: '10px' }} />
            Has Virtual Service
          </div>
        )}
      </>
    );
  };

  private renderHttpRates = group => {
    const nonServiceChildren = group.children('[nodeType != "service"]');
    const incoming = getAccumulatedTrafficRate(nonServiceChildren);
    const outgoing = getAccumulatedTrafficRate(nonServiceChildren.edgesTo('*'));

    return (
      <>
        <InOutRateTable
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

  private renderWorkloadList = (group): any[] => {
    let workloadList: any[] = [];

    group.children().forEach((node, index) => {
      const data = nodeData(node);

      if (data.workload) {
        workloadList.push(<RenderLink key={`node-${index}`} data={data} nodeType={NodeType.WORKLOAD} />);
        workloadList.push(<span key={`node-comma-${index}`}>, </span>);
      }
    });

    if (workloadList.length > 0) {
      workloadList.pop();
    }

    return workloadList;
  };

  private hasHttpTraffic = (group): boolean => {
    if (
      group
        .children()
        .filter('[rate],[rateOut]')
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
        .filter('[rateTcpSent],[rateTcpSentOut]')
        .size() > 0
    ) {
      return true;
    }
    return false;
  };
}
