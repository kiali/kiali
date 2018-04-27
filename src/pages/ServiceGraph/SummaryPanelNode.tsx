import * as React from 'react';
import * as API from '../../services/Api';

import graphUtils from '../../utils/graphing';
import { getTrafficRate, getAccumulatedTrafficRate } from '../../utils/TrafficRate';
import Badge from '../../components/Badge/Badge';
import InOutRateTable from '../../components/SummaryPanel/InOutRateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import MetricsOptions from '../../types/MetricsOptions';
import { PfColors } from '../../components/Pf/PfColors';
import { Icon } from 'patternfly-react';

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

  componentWillReceiveProps(nextProps: SummaryPanelPropType) {
    if (nextProps.data.summaryTarget && nextProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.fetchRequestCountMetrics(nextProps);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  fetchRequestCountMetrics(props: SummaryPanelPropType) {
    const namespace = props.data.summaryTarget.data('service').split('.')[1];
    const service = props.data.summaryTarget.data('service').split('.')[0];
    const version = props.data.summaryTarget.data('version');
    const options: MetricsOptions = {
      version: version,
      queryTime: props.queryTime,
      duration: +props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      filters: ['request_count', 'request_error_count']
    };
    API.getServiceMetrics(namespace, service, options)
      .then(response => {
        if (!this._isMounted) {
          console.log('SummaryPanelNode: Ignore fetch, component not mounted.');
          return;
        }
        this.showRequestCountMetrics(response);
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

  showRequestCountMetrics(xhrRequest: any) {
    const metrics = xhrRequest.data.metrics;

    this.setState({
      loading: false,
      requestCountOut: graphUtils.toC3Columns(metrics.request_count_out.matrix, 'RPS'),
      requestCountIn: graphUtils.toC3Columns(metrics.request_count_in.matrix, 'RPS'),
      errorCountIn: graphUtils.toC3Columns(metrics.request_error_count_in.matrix, 'Error'),
      errorCountOut: graphUtils.toC3Columns(metrics.request_error_count_out.matrix, 'Error')
    });
  }

  render() {
    const node = this.props.data.summaryTarget;

    const serviceSplit = node.data('service').split('.');
    const namespace = serviceSplit.length < 2 ? 'unknown' : serviceSplit[1];
    const service = serviceSplit[0];
    const serviceHotLink = <a href={`../namespaces/${namespace}/services/${service}`}>{service}</a>;

    const incoming = getTrafficRate(node);
    const outgoing = getAccumulatedTrafficRate(this.props.data.summaryTarget.edgesTo('*'));

    const isUnknown = service === 'unknown';
    return (
      <div className="panel panel-default" style={SummaryPanelNode.panelStyle}>
        <div className="panel-heading">
          Service: {isUnknown ? 'unknown' : serviceHotLink}
          <div style={{ paddingTop: '3px' }}>
            <Badge scale={0.9} style="plastic" leftText="namespace" rightText={namespace} color={PfColors.Green500} />
            <Badge
              scale={0.9}
              style="plastic"
              leftText="version"
              rightText={this.props.data.summaryTarget.data('version')}
              color={PfColors.Green500}
            />
          </div>
          {this.renderBadgeSummary(node.data('hasCB'), node.data('hasRR'))}
        </div>
        <div className="panel-body">
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

  private renderBadgeSummary = (hasCB: string, hasRR: string) => {
    const displayCB = hasCB === 'true';
    const displayRR = hasRR === 'true';
    return (
      <>
        {displayCB && (
          <div>
            <Icon name="bolt" type="fa" style={{ width: '10px' }} />
            Has Circuit Breaker
          </div>
        )}
        {displayRR && (
          <div>
            <Icon name="code-fork" type="fa" style={{ width: '10px' }} />
            Has Route Rule
          </div>
        )}
      </>
    );
  };
}
