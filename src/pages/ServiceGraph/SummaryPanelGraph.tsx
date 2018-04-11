import * as React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../../components/Badge/Badge';
import { RateTable } from '../../components/SummaryPanel/RateTable';
import { RpsChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import graphUtils from '../../utils/graphing';
import * as API from '../../services/Api';
import { NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { ActiveFilter } from '../../types/NamespaceFilter';
import * as M from '../../types/Metrics';

type SummaryPanelGraphState = {
  loading: boolean;
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
      loading: true,
      reqRates: [],
      errRates: []
    };
  }

  componentDidMount() {
    if (this.props.data.summaryTarget) {
      this.updateRpsChart(this.props);
    }
  }

  componentWillReceiveProps(nextProps: SummaryPanelPropType) {
    if (nextProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.updateRpsChart(nextProps);
    }
  }

  render() {
    const cy = this.props.data.summaryTarget;
    if (!cy) {
      return null;
    }

    let numNodes = cy
      .nodes()
      .filter('[!groupBy]')
      .size();
    let numEdges = cy.edges().size();
    let rate = 0;
    let rate3xx = 0;
    let rate4xx = 0;
    let rate5xx = 0;
    let safeRate = (s: string) => {
      return s === undefined ? 0.0 : parseFloat(s);
    };
    cy.edges().forEach(edge => {
      rate += +safeRate(edge.data('rate'));
      rate3xx += +safeRate(edge.data('rate3XX'));
      rate4xx += +safeRate(edge.data('rate4XX'));
      rate5xx += +safeRate(edge.data('rate5XX'));
    });
    const servicesLink = (
      <Link to="../services" onClick={this.updateServicesFilter}>
        {this.props.namespace}
      </Link>
    );

    return (
      <div className="panel panel-default" style={SummaryPanelGraph.panelStyle}>
        <div className="panel-heading">
          Namespace: {servicesLink}
          <div>{this.renderLabels(numNodes.toString(), numEdges.toString())}</div>
        </div>
        <div className="panel-body">
          <div>
            <RateTable
              title="Traffic (requests per second):"
              rate={rate}
              rate3xx={rate3xx}
              rate4xx={rate4xx}
              rate5xx={rate5xx}
            />
            <div>
              <hr />
              {this.renderRpsChart()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  private updateRpsChart = (props: SummaryPanelPropType) => {
    const options = {
      queryTime: props.queryTime,
      duration: props.duration,
      step: props.step,
      rateInterval: props.rateInterval
    };
    API.getNamespaceMetrics(props.namespace, options)
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
  };

  private renderLabels = (numNodes: string, numEdges: string) => (
    // color="#2d7623" is pf-green-500
    <div style={{ paddingTop: '3px' }}>
      <Badge scale={0.9} style="plastic" leftText="services" rightText={numNodes} color="#2d7623" />
      <Badge scale={0.9} style="plastic" leftText="edges" rightText={numEdges} color="#2d7623" />
    </div>
  );

  private renderRpsChart = () => {
    if (this.state.loading) {
      return <strong>loading chart...</strong>;
    }

    return <RpsChart label="Total Request Traffic" dataRps={this.state.reqRates} dataErrors={this.state.errRates} />;
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

  private updateServicesFilter = () => {
    let activeFilter: ActiveFilter = {
      label: 'Namespace: ' + this.props.namespace,
      category: 'Namespace',
      value: this.props.namespace.toString()
    };
    NamespaceFilterSelected.setSelected([activeFilter]);
  };
}
