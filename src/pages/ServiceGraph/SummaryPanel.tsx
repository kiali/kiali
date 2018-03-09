import * as React from 'react';
import ServiceInfoBadge from '../ServiceDetails/ServiceInfo/ServiceInfoBadge';
import { AreaChart, PieChart } from 'patternfly-react';

export default class SummaryPanel extends React.Component {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    bottom: 0,
    top: 0,
    right: 0
  };

  render() {
    return (
      <div className="panel panel-default" style={SummaryPanel.panelStyle}>
        <div className="panel-heading">
          <h3 className="panel-title">productpage</h3>
        </div>
        <div className="panel-body">
          <p>
            <strong>Version:</strong> 5<br />
            <strong>Labels:</strong>
            <br />
            {this.renderLabels()}
          </p>
          <p>
            <strong>
              <a href="#">Go to details page -></a>
            </strong>
          </p>
          <hr />
          <div style={{ fontSize: '1.2em' }}>
            {this.renderIncomingRpsChart()}
            {this.renderOutgoingRpsChart()}
            {this.renderSuccessRateChart()}
          </div>
        </div>
      </div>
    );
  }

  private renderLabels() {
    return (
      <>
        <ServiceInfoBadge scale={0.8} style="plastic" leftText="app" rightText="bookinfo" color="green" />
        <ServiceInfoBadge scale={0.8} style="plastic" leftText="app" rightText="product" color="green" />
        <ServiceInfoBadge scale={0.8} style="plastic" leftText="version" rightText="v5" color="navy" />
      </>
    );
  }

  private renderIncomingRpsChart() {
    return this.renderRpsChart('Incoming', [350, 400, 150, 850, 50, 220], [140, 100, 50, 700, 10, 110]);
  }

  private renderOutgoingRpsChart() {
    return this.renderRpsChart('Outgoing', [350, 400, 150], [140, 100, 130]);
  }

  private renderRpsChart(label: string, dataRps: number[], dataErrors: number[]) {
    let lastRps = dataRps.slice(-1)[0];
    let lastErrors = dataErrors.slice(-1)[0];
    let lastErrorPercent = Math.round(1000 * lastErrors / lastRps) / 10;

    let rpsColumn: Array<any> = ['RPS'];
    let errorsColumn: Array<any> = ['Errors'];

    rpsColumn = rpsColumn.concat(dataRps);
    errorsColumn = errorsColumn.concat(dataErrors);

    return (
      <>
        <div>
          <strong>{label}: </strong>
          {lastRps} RPS / {lastErrorPercent}% Error
        </div>
        <AreaChart
          size={{ height: 45 }}
          color={{ pattern: ['#0088ce', '#c00'] }}
          legend={{ show: false }}
          grid={{ y: { show: false } }}
          axis={{ x: { show: false }, y: { show: false } }}
          data={{
            columns: [rpsColumn, errorsColumn],
            type: 'area-spline'
          }}
        />
      </>
    );
  }

  private renderSuccessRateChart() {
    return (
      <>
        <div>
          <PieChart
            size={{ width: 100, height: 100 }}
            data={{
              colors: { '% Success': '#0088ce', '% Fail': '#c00' },
              columns: [['% Success', 90], ['% Fail', 10]],
              type: 'pie'
            }}
            tooltip={{ contents: () => undefined }}
            style={{ float: 'left' }}
          />
          <br />
          90% success rate <br />
          (10% failure)
        </div>
      </>
    );
  }
}
