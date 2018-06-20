import * as React from 'react';
import * as API from '../../services/Api';

import graphUtils from '../../utils/Graphing';
import { getTrafficRate, getAccumulatedTrafficRate } from '../../utils/TrafficRate';
import InOutRateTable from '../../components/SummaryPanel/InOutRateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import MetricsOptions from '../../types/MetricsOptions';
import { Metrics } from '../../types/Metrics';
import { Icon } from 'patternfly-react';
import { authentication } from '../../utils/Authentication';
import { Link } from 'react-router-dom';
import { shouldRefreshData } from './SummaryPanelCommon';
import { HealthIndicator, DisplayMode } from '../../components/ServiceHealth/HealthIndicator';
import Label from '../../components/Label/Label';

type SummaryPanelStateType = {
  loading: boolean;
  requestCountIn: [string, number][];
  requestCountOut: [string, number][];
  errorCountIn: [string, number][];
  errorCountOut: [string, number][];
};

export default class SummaryPanelNode extends React.Component<SummaryPanelPropType, SummaryPanelStateType> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    top: 0,
    right: 0,
    bottom: 0,
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
      errorCountOut: []
    };
  }

  componentDidMount() {
    this._isMounted = true;
    this.fetchRequestCountMetrics(this.props);
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (shouldRefreshData(prevProps, this.props)) {
      this.fetchRequestCountMetrics(this.props);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  fetchRequestCountMetrics(props: SummaryPanelPropType) {
    const namespace = props.data.summaryTarget.data('namespace');
    const service = props.data.summaryTarget.data('service').split('.')[0];
    const version = props.data.summaryTarget.data('version');
    const options: MetricsOptions = {
      version: version,
      queryTime: props.queryTime,
      duration: +props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      filters: ['request_count', 'request_error_count'],
      includeIstio: props.namespace === 'istio-system'
    };
    API.getServiceMetrics(authentication(), namespace, service, options)
      .then(response => {
        if (!this._isMounted) {
          console.log('SummaryPanelNode: Ignore fetch, component not mounted.');
          return;
        }
        this.showRequestCountMetrics(response.data);
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

  showRequestCountMetrics(all: Metrics) {
    const metrics = all.metrics;
    this.setState({
      loading: false,
      requestCountOut: graphUtils.toC3Columns(metrics['request_count_out'].matrix, 'RPS'),
      requestCountIn: graphUtils.toC3Columns(metrics['request_count_in'].matrix, 'RPS'),
      errorCountIn: graphUtils.toC3Columns(metrics['request_error_count_in'].matrix, 'Error'),
      errorCountOut: graphUtils.toC3Columns(metrics['request_error_count_out'].matrix, 'Error')
    });
  }

  render() {
    const node = this.props.data.summaryTarget;

    const serviceSplit = node.data('service').split('.');
    const namespace = serviceSplit.length < 2 ? 'unknown' : serviceSplit[1];
    const service = serviceSplit[0];
    const serviceHotLink = <Link to={`/namespaces/${namespace}/services/${service}`}>{service}</Link>;

    const incoming = getTrafficRate(node);
    const outgoing = getAccumulatedTrafficRate(this.props.data.summaryTarget.edgesTo('*'));

    const isUnknown = service === 'unknown';
    const health = node.data('health');
    return (
      <div className="panel panel-default" style={SummaryPanelNode.panelStyle}>
        <div className="panel-heading">
          {health && (
            <HealthIndicator
              id="graph-health-indicator"
              mode={DisplayMode.SMALL}
              health={health}
              tooltipPlacement="left"
              rateInterval={this.props.duration}
            />
          )}
          <span> Service: {isUnknown ? 'unknown' : serviceHotLink}</span>
          <div className="label-collection" style={{ paddingTop: '3px' }}>
            <Label name="namespace" value={namespace} />
            <Label name="version" value={this.props.data.summaryTarget.data('version')} />
          </div>
          {this.renderBadgeSummary(node.data('hasCB'), node.data('hasRR'), node.data('hasMissingSC'))}
        </div>
        <div className="panel-body">
          {!isUnknown && (
            <p style={{ textAlign: 'right' }}>
              <Link
                to={`/namespaces/${namespace}/services/${service}?tab=metrics&groupings=local+version%2Cresponse+code`}
              >
                View detailed charts <Icon name="angle-double-right" />
              </Link>
            </p>
          )}
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

  private renderBadgeSummary = (hasCB: boolean, hasRR: boolean, hasMissingSC: boolean) => {
    return (
      <>
        {hasCB && (
          <div>
            <Icon name="bolt" type="fa" style={{ width: '10px' }} />
            Has Circuit Breaker
          </div>
        )}
        {hasRR && (
          <div>
            <Icon name="code-fork" type="fa" style={{ width: '10px' }} />
            Has Route Rule
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
