import * as React from 'react';
import * as API from '../../services/Api';

import graphUtils from '../../utils/graphing';
import ServiceInfoBadge from '../../pages/ServiceDetails/ServiceInfo/ServiceInfoBadge';
import { InOutRateTable } from '../../components/SummaryPanel/InOutRateTable';
import { RpsChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';

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
    right: 0
  };

  static readonly RATE = 'rate';
  static readonly RATE3XX = 'rate3XX';
  static readonly RATE4XX = 'rate4xx';
  static readonly RATE5XX = 'rate5xx';

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
    const namespace = this.props.data.summaryTarget.data('service').split('.')[1];
    const service = this.props.data.summaryTarget.data('service').split('.')[0];
    const version = this.props.data.summaryTarget.data('version');
    const options = {
      version: version,
      rateInterval: this.props.rateInterval
    };

    API.getServiceMetrics(namespace, service, options)
      .then(this.showRequestCountMetrics)
      .catch(error => {
        this.setState({ loading: false });
        console.error(error);
      });
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

    const namespace = node.data('service').split('.')[1];
    const service = node.data('service').split('.')[0];
    const serviceHotLink = <a href={`../namespaces/${namespace}/services/${service}`}>{service}</a>;

    let outgoing = { rate: 0, rate3xx: 0, rate4xx: 0, rate5xx: 0 };

    // aggregate all outgoing rates
    this.props.data.summaryTarget.edgesTo('*').forEach(c => {
      outgoing.rate += parseFloat(c.data(SummaryPanelNode.RATE)) || 0;
      outgoing.rate3xx += parseFloat(c.data(SummaryPanelNode.RATE3XX)) || 0;
      outgoing.rate4xx += parseFloat(c.data(SummaryPanelNode.RATE4XX)) || 0;
      outgoing.rate5xx += parseFloat(c.data(SummaryPanelNode.RATE5XX)) || 0;
    });

    return (
      <div className="panel panel-default" style={SummaryPanelNode.panelStyle}>
        <div className="panel-heading">Microservice: {serviceHotLink}</div>
        <div className="panel-body">
          <p>
            <strong>Labels:</strong>
            <br />
            <ServiceInfoBadge
              scale={0.8}
              style="plastic"
              leftText="namespace"
              rightText={namespace}
              key={namespace}
              color="#2d7623" // pf-green-500
            />
            <ServiceInfoBadge
              scale={0.8}
              style="plastic"
              leftText="version"
              rightText={this.props.data.summaryTarget.data('version')}
              key={this.props.data.summaryTarget.data('version')}
              color="#2d7623" // pf-green-500
            />
          </p>
          <hr />
          <InOutRateTable
            title="Request Traffic (requests per second):"
            inRate={parseFloat(node.data('rate')) || 0}
            inRate3xx={parseFloat(node.data('rate3xx')) || 0}
            inRate4xx={parseFloat(node.data('rate4xx')) || 0}
            inRate5xx={parseFloat(node.data('rate5xx')) || 0}
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

  renderRpsCharts = () => {
    if (this.state.loading) {
      return <strong>loading charts...</strong>;
    }
    return (
      <>
        <RpsChart label="Incoming" dataRps={this.state.requestCountIn} dataErrors={this.state.errorCountIn} />
        <RpsChart label="Outgoing" dataRps={this.state.requestCountOut} dataErrors={this.state.errorCountOut} />
      </>
    );
  };
}
