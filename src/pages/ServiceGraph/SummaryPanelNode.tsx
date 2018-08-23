import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from 'patternfly-react';

import { getTrafficRate, getAccumulatedTrafficRate } from '../../utils/TrafficRate';
import InOutRateTable from '../../components/SummaryPanel/InOutRateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import { Metrics, Metric } from '../../types/Metrics';
import {
  shouldRefreshData,
  updateHealth,
  nodeData,
  NodeData,
  NodeMetricType,
  getDatapoints,
  getNodeMetrics,
  getNodeMetricType,
  getServicesLinkList,
  renderPanelTitle
} from './SummaryPanelCommon';
import { HealthIndicator, DisplayMode } from '../../components/Health/HealthIndicator';
import Label from '../../components/Label/Label';
import { Health } from '../../types/Health';

type SummaryPanelStateType = {
  loading: boolean;
  requestCountIn: [string, number][];
  requestCountOut: [string, number][];
  errorCountIn: [string, number][];
  errorCountOut: [string, number][];
  healthLoading: boolean;
  health?: Health;
  rpsMetrics: boolean;
};

export default class SummaryPanelNode extends React.Component<SummaryPanelPropType, SummaryPanelStateType> {
  static readonly panelStyle = {
    width: '25em',
    minWidth: '25em',
    overflowY: 'auto' as 'auto'
  };

  // avoid state changes after component is unmounted
  _isMounted: boolean = false;

  constructor(props: SummaryPanelPropType) {
    super(props);
    this.showRequestCountMetrics = this.showRequestCountMetrics.bind(this);

    this.state = {
      loading: true,
      requestCountIn: [],
      requestCountOut: [],
      errorCountIn: [],
      errorCountOut: [],
      healthLoading: false,
      rpsMetrics: true
    };
  }

  componentDidMount() {
    this._isMounted = true;
    this.fetchRequestCountMetrics(this.props);
    updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (shouldRefreshData(prevProps, this.props)) {
      this.fetchRequestCountMetrics(this.props);
      updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  fetchRequestCountMetrics(props: SummaryPanelPropType) {
    const target = props.data.summaryTarget;
    const data = nodeData(target);
    const nodeMetricType = getNodeMetricType(data);

    if (!nodeMetricType) {
      return;
    }

    const filters = ['request_count', 'request_error_count'];
    let byLabelsIn = nodeMetricType === NodeMetricType.SERVICE ? ['destination_workload'] : undefined;
    let byLabelsOut = data.isRoot ? ['destination_service_namespace'] : undefined;
    getNodeMetrics(nodeMetricType, target, props, filters, byLabelsIn, byLabelsOut)
      .then(response => {
        if (!this._isMounted) {
          console.log('SummaryPanelNode: Ignore fetch, component not mounted.');
          return;
        }
        this.showRequestCountMetrics(response.data, data, nodeMetricType);
      })
      .catch(error => {
        if (!this._isMounted) {
          console.log('SummaryPanelNode: Ignore fetch error, component not mounted.');
          return;
        }
        this.setState({ loading: false });
        console.error(error);
      });

    this.setState({ loading: true });
  }

  showRequestCountMetrics(all: Metrics, data: NodeData, nodeMetricType: NodeMetricType) {
    let comparator;
    if (nodeMetricType === NodeMetricType.SERVICE) {
      comparator = (metric: Metric) => {
        return metric['destination_workload'] === 'unknown';
      };
    } else if (data.isRoot) {
      comparator = (metric: Metric) => {
        return metric['destination_service_namespace'] === this.props.namespace;
      };
    }
    let metrics;
    let rcOut;
    let ecOut;
    let rcIn;
    let ecIn;
    // ignore outgoing for non-root outsiders (because there are no outgoing edges)
    if (data.isRoot || !data.isOutsider) {
      // use source metrics for outgoing, except for:
      // - unknown nodes with no source telemetry
      // - it is the istio namespace
      let useDest = data.nodeType === NodeType.UNKNOWN;
      useDest = useDest || this.props.namespace === 'istio-system';
      metrics = useDest ? all.dest.metrics : all.source.metrics;
      rcOut = metrics['request_count_out'];
      ecOut = metrics['request_error_count_out'];
    }
    // ignore incoming roots (because there are no incoming edges)
    if (data.isRoot || !data.isOutsider) {
      // use dest metrics for incoming, except for service nodes capturing source errors
      metrics = data.nodeType === NodeType.SERVICE ? all.source.metrics : all.dest.metrics;
      rcIn = metrics['request_count_in'];
      ecIn = metrics['request_error_count_in'];
    }
    this.setState({
      loading: false,
      requestCountOut: getDatapoints(rcOut, 'RPS', comparator),
      errorCountOut: getDatapoints(ecOut, 'Error', comparator),
      requestCountIn: getDatapoints(rcIn, 'RPS', comparator),
      errorCountIn: getDatapoints(ecIn, 'Error', comparator)
    });
  }

  render() {
    const node = this.props.data.summaryTarget;
    const { namespace, nodeType, workload } = nodeData(node);
    const incoming = getTrafficRate(node);
    const outgoing = getAccumulatedTrafficRate(this.props.data.summaryTarget.edgesTo('*'));
    const servicesList = nodeType !== NodeType.SERVICE && getServicesLinkList([node]);

    const shouldRenderSvcList = servicesList && servicesList.length > 0;
    const shouldRenderWorkload = nodeType !== NodeType.WORKLOAD && workload;

    return (
      <div className="panel panel-default" style={SummaryPanelNode.panelStyle}>
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
          <span>{[' ', renderPanelTitle(node)]}</span>
          <div className="label-collection" style={{ paddingTop: '3px' }}>
            <Label name="namespace" value={namespace} />
            {node.data('version') && <Label name="version" value={node.data('version')} />}
          </div>
          {this.renderBadgeSummary(node.data('hasCB'), node.data('hasVS'), node.data('hasMissingSC'))}
        </div>
        <div className="panel-body">
          {shouldRenderSvcList && (
            <div>
              <strong>Services: </strong>
              {servicesList}
            </div>
          )}
          {shouldRenderWorkload && (
            <div>
              <strong>Workload: </strong>
              <Link to={`/namespaces/${encodeURIComponent(namespace)}/workloads/${encodeURIComponent(workload)}`}>
                {workload}
              </Link>
            </div>
          )}
          {(shouldRenderSvcList || shouldRenderWorkload) && <hr />}
          {/* TODO: link to App or Workload Details charts when available
          {nodeType !== NodeType.UNKNOWN && (
            <p style={{ textAlign: 'right' }}>
              <Link to={`/namespaces/${namespace}/services/${app}?tab=metrics&groupings=local+version%2Cresponse+code`}>
                View detailed charts <Icon name="angle-double-right" />
              </Link>
            </p>
          )} */}
          <InOutRateTable
            title="Request Traffic (requests per second):"
            inRate={incoming.rate}
            inRate3xx={incoming.rate3xx}
            inRate4xx={incoming.rate4xx}
            inRate5xx={incoming.rate5xx}
            outRate={outgoing.rate}
            outRate3xx={outgoing.rate3xx}
            outRate4xx={outgoing.rate4xx}
            outRate5xx={outgoing.rate5xx}
          />
          <div>{this.renderRpsCharts()}</div>
        </div>
      </div>
    );
  }

  private renderRpsCharts = () => {
    if (this.state.loading) {
      return <strong>loading charts...</strong>;
    } else if (!this.state.rpsMetrics) {
      return;
    }
    return (
      <>
        <RpsChart
          label="Incoming Request Traffic"
          dataRps={this.state.requestCountIn}
          dataErrors={this.state.errorCountIn}
        />
        <RpsChart
          label="Outgoing Request Traffic"
          dataRps={this.state.requestCountOut}
          dataErrors={this.state.errorCountOut}
        />
      </>
    );
  };

  private renderBadgeSummary = (hasCB: boolean, hasVS: boolean, hasMissingSC: boolean) => {
    return (
      <>
        {hasCB && (
          <div>
            <Icon name="bolt" type="fa" style={{ width: '10px' }} />
            Has Circuit Breaker
          </div>
        )}
        {hasVS && (
          <div>
            <Icon name="code-fork" type="fa" style={{ width: '10px' }} />
            Has Virtual Service
          </div>
        )}
        {hasMissingSC && (
          <div>
            <Icon name="blueprint" type="pf" style={{ width: '10px', fontSize: '0.7em' }} />
            Has Missing Sidecars
          </div>
        )}
      </>
    );
  };
}
