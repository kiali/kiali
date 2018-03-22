import * as React from 'react';
import ServiceInfoBadge from '../../pages/ServiceDetails/ServiceInfo/ServiceInfoBadge';
import { RateTable } from '../../components/SummaryPanel/RateTable';
import { RpsChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import graphUtils from '../../utils/graphing';
import * as API from '../../services/Api';
import * as M from '../../types/Metrics';

type SummaryPanelGraphState = {
  initialized: boolean;
  loading: boolean;
  numNodes: number;
  numEdges: number;
  rate: number;
  rate3xx: number;
  rate4xx: number;
  rate5xx: number;
  reqRates: [string, number][];
  errRates: [string, number][];
};

export default class SummaryPanelGraph extends React.Component<SummaryPanelPropType, SummaryPanelGraphState> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    bottom: 0,
    top: 0,
    right: 0
  };

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = {
      initialized: false,
      loading: true,
      numNodes: 0,
      numEdges: 0,
      rate: 0,
      rate3xx: 0,
      rate4xx: 0,
      rate5xx: 0,
      reqRates: [],
      errRates: []
    };

    const cy = this.props.data.summaryTarget;
    if (cy !== undefined) {
      this.initState(cy);
    }
  }

  componentWillReceiveProps(nextProps: SummaryPanelPropType) {
    if (this.state.initialized) {
      return;
    }
    const cy = nextProps.data.summaryTarget;
    if (cy === undefined) {
      return;
    }

    this.initState(cy);

    const options = {
      rateInterval: this.props.rateInterval
    };
    API.getNamespaceMetrics(this.props.namespace, options)
      .then(response => {
        const data: M.Metrics = response['data'];
        const metrics: Map<String, M.MetricGroup> = data.metrics;
        const reqRates = this.getRates(metrics['request_count_in'], 'RPS');
        const errRates = this.getRates(metrics['request_error_count_in'], 'Error');

        this.setState({
          loading: false,
          reqRates: reqRates,
          errRates: errRates
        });
      })
      .catch(error => {
        this.setState({ loading: false });
        console.error(error);
        // this.props.onError(error);
      });
  }

  render() {
    // TODO, the query param is not currently supported, but this is maybe what will be used...
    const servicesLink = <a href={`../services?namespace=${this.props.namespace}`}>{this.props.namespace}</a>;

    return (
      <div className="panel panel-default" style={SummaryPanelGraph.panelStyle}>
        <div className="panel-heading">Namespace: {servicesLink}</div>
        <div className="panel-body" hidden={this.state.initialized}>
          <h3>Click graph background to see summary information...</h3>
        </div>
        <div hidden={!this.state.initialized}>
          <div className="panel-body">
            <p>{this.renderLabels(this.state.numNodes.toString(), this.state.numEdges.toString())}</p>
          </div>
          <hr />
          <RateTable
            title="Traffic (requests per second):"
            rate={this.state.rate}
            rate3xx={this.state.rate3xx}
            rate4xx={this.state.rate4xx}
            rate5xx={this.state.rate5xx}
          />
          <div>
            <hr />
            {this.renderRpsChart()}
          </div>
        </div>
      </div>
    );
  }

  private initState = cy => {
    let numNodes = 0;
    let numEdges = 0;
    let rate = 0;
    let rate3xx = 0;
    let rate4xx = 0;
    let rate5xx = 0;
    let safeRate = (s: string) => {
      return s === undefined ? 0.0 : parseFloat(s);
    };

    numNodes = cy.nodes().size();
    numEdges = cy.edges().size();
    cy.edges().forEach(edge => {
      rate += +safeRate(edge.data('rate'));
      rate3xx += +safeRate(edge.data('rate3XX'));
      rate4xx += +safeRate(edge.data('rate4XX'));
      rate5xx += +safeRate(edge.data('rate5XX'));
    });

    this.setState({
      initialized: true,
      numNodes: numNodes,
      numEdges: numEdges,
      rate: rate,
      rate3xx: rate3xx,
      rate4xx: rate4xx,
      rate5xx: rate5xx
    });
  };

  private renderLabels = (numNodes: string, numEdges: string) => (
    <>
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="services" rightText={numNodes} color="green" />
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="edges" rightText={numEdges} color="green" />
    </>
  );

  private renderRpsChart = () => {
    if (this.state.loading) {
      return <strong>loading chart...</strong>;
    }

    return <RpsChart label="Request Average" dataRps={this.state.reqRates} dataErrors={this.state.errRates} />;
  };

  private getRates = (mg: M.MetricGroup, title: string): [string, number][] => {
    const tsa: M.TimeSeries[] = mg.matrix;
    let series: M.TimeSeries[] = [];

    for (let i = 0; i < tsa.length; ++i) {
      const ts = tsa[i];
      series.push(ts);
    }
    return graphUtils.toC3Columns(series, title);
  };
}
