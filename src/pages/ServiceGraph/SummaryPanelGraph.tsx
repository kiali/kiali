import * as React from 'react';
import { Link } from 'react-router-dom';
import RateTable from '../../components/SummaryPanel/RateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import graphUtils from '../../utils/graphing';
import * as API from '../../services/Api';
import { NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { ActiveFilter } from '../../types/NamespaceFilter';
import * as M from '../../types/Metrics';
import { Icon } from 'patternfly-react';

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

  // avoid state changes after component is unmounted
  _isMounted: boolean = false;

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = {
      loading: true,
      reqRates: [],
      errRates: []
    };
  }

  componentDidMount() {
    // don't load data here, wit until props are updated after the graph is loaded
    this._isMounted = true;
  }

  componentWillReceiveProps(nextProps: SummaryPanelPropType) {
    if (nextProps.data.summaryTarget && nextProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.updateRpsChart(nextProps);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    const cy = this.props.data.summaryTarget;
    if (!cy) {
      return null;
    }

    const numNodes = cy
      .nodes()
      .filter('[!groupBy]')
      .filter('[service!="unknown"]')
      .size();
    const numEdges = cy.edges().size();
    const safeRate = (s: string) => {
      return s ? parseFloat(s) : 0.0;
    };
    const rate = cy.edges().reduce((r = 0, edge) => r + safeRate(edge.data('rate')), 0);
    const rate3xx = cy.edges().reduce((r = 0, edge) => r + safeRate(edge.data('rate3XX')), 0);
    const rate4xx = cy.edges().reduce((r = 0, edge) => r + safeRate(edge.data('rate4XX')), 0);
    const rate5xx = cy.edges().reduce((r = 0, edge) => r + safeRate(edge.data('rate5XX')), 0);
    const servicesLink = (
      <Link to="../services" onClick={this.updateServicesFilter}>
        {this.props.namespace}
      </Link>
    );

    return (
      <div className="panel panel-default" style={SummaryPanelGraph.panelStyle}>
        <div className="panel-heading">
          Namespace: {servicesLink}
          {this.renderTopologySummary(numNodes, numEdges)}
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
    // console.log('loadNamespaceMetrics SummaryGraph');
    API.getNamespaceMetrics(props.namespace, options)
      .then(response => {
        if (!this._isMounted) {
          console.log('SummaryPanelGraph: Ignore fetch, component not mounted.');
          return;
        }

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
        if (!this._isMounted) {
          console.log('SummaryPanelGraph: Ignore fetch error, component not mounted.');
          return;
        }

        this.setState({ loading: false });
        console.error(error);
        // this.props.onError(error);
      });
  };

  private renderTopologySummary = (numNodes: number, numEdges: number) => (
    <div>
      <Icon name="service" type="pf" style={{ padding: '0 1em' }} />
      {numNodes.toString()} {numNodes === 1 ? 'service' : 'services'}
      <Icon name="topology" type="pf" style={{ padding: '0 1em' }} />
      {numEdges.toString()} {numEdges === 1 ? 'link' : 'links'}
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
