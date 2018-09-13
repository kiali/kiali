import * as React from 'react';
import { Link } from 'react-router-dom';
import RateTable from '../../components/SummaryPanel/RateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import graphUtils from '../../utils/Graphing';
import { getAccumulatedTrafficRate } from '../../utils/TrafficRate';
import * as API from '../../services/Api';
import { NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { ActiveFilter } from '../../types/NamespaceFilter';
import * as M from '../../types/Metrics';
import { Icon } from 'patternfly-react';
import { authentication } from '../../utils/Authentication';
import { shouldRefreshData } from './SummaryPanelCommon';
import { Response } from '../../services/Api';
import { Metrics } from '../../types/Metrics';
import { CancelablePromise, makeCancelablePromise } from '../../utils/Common';

type SummaryPanelGraphState = {
  loading: boolean;
  reqRates: [string, number][] | null;
  errRates: [string, number][];
  metricsLoadError: string | null;
};

export default class SummaryPanelGraph extends React.Component<SummaryPanelPropType, SummaryPanelGraphState> {
  static readonly panelStyle = {
    width: '25em',
    minWidth: '25em',
    overflowY: 'auto' as 'auto'
  };

  private metricsPromise?: CancelablePromise<Response<Metrics>>;

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = {
      loading: true,
      reqRates: null,
      errRates: [],
      metricsLoadError: null
    };
  }

  componentDidMount() {
    if (this.props.namespace !== 'all') {
      this.updateRpsChart(this.props);
    }
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.setState({
        reqRates: null,
        loading: true
      });
    }

    if (shouldRefreshData(prevProps, this.props)) {
      // TODO (maybe) we omit the rps chart when dealing with multiple namespaces. There is no backend
      // API support to gather the data. The whole-graph chart is of nominal value, it will likely be OK.
      if (this.props.namespace !== 'all') {
        this.updateRpsChart(this.props);
      }
    }
  }

  componentWillUnmount() {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
  }

  render() {
    const cy = this.props.data.summaryTarget;
    if (!cy) {
      return null;
    }

    const numNodes = cy
      .nodes()
      .filter('[!isGroup]')
      .filter('[!isRoot]')
      .size();
    const numEdges = cy.edges().size();
    const trafficRate = getAccumulatedTrafficRate(cy.edges());
    const servicesLink = (
      <Link
        to={this.props.namespace === 'all' ? '../services' : `../services?namespace=${this.props.namespace}`}
        onClick={this.updateServicesFilter}
      >
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
              rate={trafficRate.rate}
              rate3xx={trafficRate.rate3xx}
              rate4xx={trafficRate.rate4xx}
              rate5xx={trafficRate.rate5xx}
            />
            {this.props.namespace !== 'all' && (
              <div>
                <hr />
                {this.renderRpsChart()}
              </div>
            )}
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
    const promise = API.getNamespaceMetrics(authentication(), props.namespace, options);
    this.metricsPromise = makeCancelablePromise(promise);

    this.metricsPromise.promise
      .then(response => {
        const metrics = response.data.dest.metrics;
        const reqRates = this.getRates(metrics['request_count_in'], 'RPS');
        const errRates = this.getRates(metrics['request_error_count_in'], 'Error');

        this.setState({
          loading: false,
          reqRates: reqRates,
          errRates: errRates
        });
      })
      .catch(error => {
        if (error.isCanceled) {
          console.log('SummaryPanelGraph: Ignore fetch error (canceled).');
          return;
        }
        const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
        this.setState({
          loading: false,
          metricsLoadError: errorMsg,
          reqRates: null
        });
      });

    this.setState({ loading: true, metricsLoadError: null });
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
    if (this.state.loading && !this.state.reqRates) {
      return <strong>Loading chart...</strong>;
    } else if (this.state.metricsLoadError) {
      return (
        <div>
          <Icon type="pf" name="warning-triangle-o" /> <strong>Error loading metrics: </strong>
          {this.state.metricsLoadError}
        </div>
      );
    }

    return <RpsChart label="Total Request Traffic" dataRps={this.state.reqRates!} dataErrors={this.state.errRates} />;
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
    let filters: ActiveFilter[] = [];
    if (this.props.namespace !== 'all') {
      let activeFilter: ActiveFilter = {
        label: 'Namespace: ' + this.props.namespace,
        category: 'Namespace',
        value: this.props.namespace.toString()
      };
      filters = [activeFilter];
    }
    NamespaceFilterSelected.setSelected(filters);
  };
}
