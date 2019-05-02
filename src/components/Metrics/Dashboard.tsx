import * as React from 'react';
import { Link } from 'react-router-dom';
import { Col, Icon, Row } from 'patternfly-react';
import { style } from 'typestyle';

import history from '../../app/History';
import * as M from '../../types/Metrics';

import HistogramChart from './HistogramChart';
import MetricChart from './MetricChart';

const expandedChartContainerStyle = style({
  height: 'calc(100vh - 248px)'
});

const expandedChartBackLinkStyle = style({
  marginTop: '-1.7em',
  textAlign: 'right'
});

type DashboardProps = {
  dashboard: M.MonitoringDashboard;
  labelValues: M.AllPromLabelsValues;
};

export class Dashboard extends React.Component<DashboardProps, {}> {
  constructor(props: DashboardProps) {
    super(props);
  }

  render() {
    const urlParams = new URLSearchParams(history.location.search);
    const expandedChart = urlParams.get('expand');
    urlParams.delete('expand');
    const notExpandedLink = history.location.pathname + '?' + urlParams.toString();

    return (
      <div>
        {expandedChart && (
          <h3 className={expandedChartBackLinkStyle}>
            <Link to={notExpandedLink}>
              <Icon name="angle-double-left" /> View all metrics
            </Link>
          </h3>
        )}
        {expandedChart ? this.renderExpandedChart(expandedChart) : this.renderMetrics()}
      </div>
    );
  }

  renderMetrics() {
    return (
      <div className="card-pf">
        <Row>{this.props.dashboard.charts.map(c => this.renderChartCard(c))}</Row>
      </div>
    );
  }

  private renderExpandedChart(chartKey: string) {
    const chart = this.props.dashboard.charts.find(c => c.name === chartKey);
    if (chart) {
      return <div className={expandedChartContainerStyle}>{this.renderChart(chart)}</div>;
    }
    return undefined;
  }

  private renderChartCard(chart: M.Chart) {
    return (
      <Col xs={12} sm={12} md={chart.spans} key={chart.name}>
        {this.renderChart(chart, () => this.onExpandHandler(chart.name))}
      </Col>
    );
  }

  private renderChart(chart: M.Chart, expandHandler?: () => void) {
    if (chart.metric) {
      return (
        <MetricChart
          key={chart.name}
          chartName={chart.name}
          labelValues={this.props.labelValues}
          unit={chart.unit}
          spans={chart.spans}
          series={chart.metric.matrix}
          onExpandRequested={expandHandler}
        />
      );
    } else if (chart.histogram) {
      return (
        <HistogramChart
          key={chart.name}
          chartName={chart.name}
          labelValues={this.props.labelValues}
          unit={chart.unit}
          spans={chart.spans}
          histogram={chart.histogram}
          onExpandRequested={expandHandler}
        />
      );
    }
    return undefined;
  }

  private onExpandHandler = (chartKey: string): void => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set('expand', chartKey);
    history.push(history.location.pathname + '?' + urlParams.toString());
  };
}
