import * as React from 'react';

import ServiceInfoBadge from '../../pages/ServiceDetails/ServiceInfo/ServiceInfoBadge';
import { ErrorRatePieChart } from '../../components/SummaryPanel/ErrorRatePieChart';
import { RpsChart } from '../../components/SummaryPanel/RpsChart';

type SummaryPanelPropType = {
  data: any;
};

export default class SummaryPanelEdge extends React.Component<SummaryPanelPropType, {}> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    bottom: 0,
    top: 0,
    right: 0
  };

  render() {
    const namespace = 'TBD';
    const service = 'TBD';
    const serviceHotLink = <a href={`../namespaces/${namespace}/services/${service}`}>{service}</a>;

    return (
      <div className="panel panel-default" style={SummaryPanelEdge.panelStyle}>
        <div className="panel-heading">Group: {serviceHotLink} (v5)</div>
        <div className="panel-body">
          <p>
            <strong>Labels:</strong>
            <br />
            {this.renderLabels()}
          </p>
          <hr />
          <div style={{ fontSize: '1.2em' }}>
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
    return (
      <RpsChart label="Incoming" dataRps={[350, 400, 150, 850, 50, 220]} dataErrors={[140, 100, 50, 700, 10, 110]} />
    );
  };

  renderOutgoingRpsChart = () => {
    return <RpsChart label="Outgoing" dataRps={[350, 400, 150]} dataErrors={[140, 100, 130]} />;
  };
}
