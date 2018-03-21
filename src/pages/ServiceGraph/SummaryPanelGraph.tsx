import * as React from 'react';

import ServiceInfoBadge from '../../pages/ServiceDetails/ServiceInfo/ServiceInfoBadge';
import { ErrorRatePieChart } from '../../components/SummaryPanel/ErrorRatePieChart';
import { RpsChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';

export default class SummaryPanelGraph extends React.Component<SummaryPanelPropType, {}> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    bottom: 0,
    top: 0,
    right: 0
  };

  render() {
    return (
      <div className="panel panel-default" style={SummaryPanelGraph.panelStyle}>
        <div className="panel-heading">TBD</div>
        <div className="panel-body">
          <p>
            <strong>Labels:</strong>
            <br />
            {this.renderLabels()}
          </p>
          <hr />
          <div>
            {this.renderIncomingRpsChart()}
            {this.renderOutgoingRpsChart()}
            <ErrorRatePieChart percentError={10} />
          </div>
        </div>
      </div>
    );
  }

  renderLabels = () => (
    <>
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="app" rightText="bookinfo" color="green" />
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="app" rightText="product" color="green" />
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="version" rightText="v5" color="navy" />
    </>
  );

  renderIncomingRpsChart = () => {
    const dataRps: any = [['x', 1500, 3500, 5500, 7500, 9500, 10500], ['RPS', 350, 400, 150, 850, 50, 220]];
    const dataErrors: any = [['x', 1500, 3500, 5500, 7500, 9500, 10500], ['Error', 140, 100, 50, 700, 10, 110]];

    return <RpsChart label="Incoming" dataRps={dataRps} dataErrors={dataErrors} />;
  };

  renderOutgoingRpsChart = () => {
    const dataRps: any = [['x', 1500, 3500, 5500], ['RPS', 350, 400, 150]];
    const dataErrors: any = [['x', 1500, 3500, 5500], ['Error', 140, 100, 130]];

    return <RpsChart label="Outgoing" dataRps={dataRps} dataErrors={dataErrors} />;
  };
}
