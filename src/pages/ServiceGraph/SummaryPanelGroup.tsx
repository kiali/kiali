import * as React from 'react';

import ServiceInfoBadge from '../../pages/ServiceDetails/ServiceInfo/ServiceInfoBadge';
import { InOutRateTable } from '../../components/SummaryPanel/InOutRateTable';
import { RpsChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import * as API from '../../services/Api';
import * as M from '../../types/Metrics';
import graphUtils from '../../utils/graphing';

type SummaryPanelState = {
  loading: boolean;
  requestCountIn: [string, number][];
  requestCountOut: [string, number][];
  errorCountIn: [string, number][];
  errorCountOut: [string, number][];
};

export default class SummaryPanelGroup extends React.Component<SummaryPanelPropType, SummaryPanelState> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    top: 0,
    right: 0
  };

  constructor(props: SummaryPanelPropType) {
    super(props);
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
    const options = {
      rateInterval: this.props.rateInterval
    };
    API.getServiceMetrics(namespace, service, options)
      .then(response => {
        const data: M.Metrics = response['data'];
        const metrics: Map<String, M.MetricGroup> = data.metrics;

        const reqCountIn: M.MetricGroup = metrics['request_count_in'];
        const reqCountOut: M.MetricGroup = metrics['request_count_out'];
        const errCountIn: M.MetricGroup = metrics['request_error_count_in'];
        const errCountOut: M.MetricGroup = metrics['request_error_count_out'];

        this.setState({
          loading: false,
          requestCountIn: graphUtils.toC3Columns(reqCountIn.matrix, 'RPS'),
          requestCountOut: graphUtils.toC3Columns(reqCountOut.matrix, 'RPS'),
          errorCountIn: graphUtils.toC3Columns(errCountIn.matrix, 'Error'),
          errorCountOut: graphUtils.toC3Columns(errCountOut.matrix, 'Error')
        });
      })
      .catch(error => {
        // TODO: show error alert
        this.setState({ loading: false });
        console.error(error);
      });
  }

  render() {
    const namespace = this.props.data.summaryTarget.data('service').split('.')[1];
    const service = this.props.data.summaryTarget.data('service').split('.')[0];
    const serviceHotLink = <a href={`../namespaces/${namespace}/services/${service}`}>{service}</a>;

    const RATE = 'rate';
    const RATE3XX = 'rate3XX';
    const RATE4XX = 'rate4xx';
    const RATE5XX = 'rate5xx';

    let incoming = { rate: 0, rate3xx: 0, rate4xx: 0, rate5xx: 0, rateErr: 0, percentErr: 0 };
    let outgoing = { rate: 0, rate3xx: 0, rate4xx: 0, rate5xx: 0, rateErr: 0, percentErr: 0 };

    // aggregate all incoming rates
    this.props.data.summaryTarget
      .children()
      .toArray()
      .forEach(c => {
        if (c.data(RATE) !== undefined) {
          incoming.rate += +c.data(RATE);
        }
        if (c.data(RATE3XX) !== undefined) {
          incoming.rate3xx += +c.data(RATE3XX);
          incoming.rateErr += +c.data(RATE3XX);
        }
        if (c.data(RATE4XX) !== undefined) {
          incoming.rate4xx += +c.data(RATE4XX);
          incoming.rateErr += +c.data(RATE4XX);
        }
        if (c.data(RATE5XX) !== undefined) {
          incoming.rate5xx += +c.data(RATE5XX);
          incoming.rateErr += +c.data(RATE5XX);
        }
      });
    if (incoming.rateErr !== 0) {
      incoming.percentErr = incoming.rateErr / incoming.rate * 100.0;
    }
    console.log('Aggregate incoming [' + namespace + '.' + service + ': ' + JSON.stringify(incoming));

    // aggregate all outgoing rates
    this.props.data.summaryTarget
      .children()
      .edgesTo('*')
      .forEach(c => {
        if (c.data(RATE) !== undefined) {
          outgoing.rate += +c.data(RATE);
        }
        if (c.data(RATE3XX) !== undefined) {
          outgoing.rate3xx += +c.data(RATE3XX);
          outgoing.rateErr += +c.data(RATE3XX);
        }
        if (c.data(RATE4XX) !== undefined) {
          outgoing.rate4xx += +c.data(RATE4XX);
          outgoing.rateErr += +c.data(RATE4XX);
        }
        if (c.data(RATE5XX) !== undefined) {
          outgoing.rate5xx += +c.data(RATE5XX);
          outgoing.rateErr += +c.data(RATE5XX);
        }
      });
    if (outgoing.rateErr !== 0) {
      outgoing.percentErr = outgoing.rateErr / outgoing.rate * 100.0;
    }
    console.log('Aggregate outgoing [' + namespace + '.' + service + ': ' + JSON.stringify(outgoing));

    return (
      <div className="panel panel-default" style={SummaryPanelGroup.panelStyle}>
        <div className="panel-heading">Versioned Group: {serviceHotLink}</div>
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
            {this.renderVersionBadges()}
          </p>
          <hr />
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
          <hr />
          <div>{this.renderRpsCharts()}</div>
        </div>
      </div>
    );
  }

  renderVersionBadges = () => {
    return this.props.data.summaryTarget
      .children()
      .toArray()
      .map((c, i) => (
        <ServiceInfoBadge
          scale={0.8}
          style="plastic"
          leftText="version"
          rightText={c.data('version')}
          key={c.data('version')}
          color="#2d7623" // pf-green-500
        />
      ));
  };

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
