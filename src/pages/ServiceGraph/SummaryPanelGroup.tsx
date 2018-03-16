import * as React from 'react';

import ServiceInfoBadge from '../../pages/ServiceDetails/ServiceInfo/ServiceInfoBadge';
import { ErrorRatePieChart } from '../../components/SummaryPanel/ErrorRatePieChart';
import { RpsChart } from '../../components/SummaryPanel/RpsChart';

type SummaryPanelPropType = {
  data: any;
};

export default class SummaryPanelGroup extends React.Component<SummaryPanelPropType, {}> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    bottom: 0,
    top: 0,
    right: 0
  };

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
              color="green"
            />
            {this.renderVersionBadges()}
          </p>
          <hr />
          <div>
            <strong>Incoming Traffic (requests per second): </strong>
            <table className="table">
              <thead>
                <tr>
                  <th>Total</th>
                  <th>3xx</th>
                  <th>4xx</th>
                  <th>5xx</th>
                  <th>% Error</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{incoming.rate.toFixed(2)}</td>
                  <td>{incoming.rate3xx.toFixed(2)}</td>
                  <td>{incoming.rate4xx.toFixed(2)}</td>
                  <td>{incoming.rate5xx.toFixed(2)}</td>
                  <td>{incoming.percentErr.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <ErrorRatePieChart percentError={incoming.percentErr} />
          </div>
          <div>
            <strong>Outgoing Traffic (requests per second): </strong>
            <table className="table">
              <thead>
                <tr>
                  <th>Total</th>
                  <th>3xx</th>
                  <th>4xx</th>
                  <th>5xx</th>
                  <th>% Error</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{outgoing.rate.toFixed(2)}</td>
                  <td>{outgoing.rate3xx.toFixed(2)}</td>
                  <td>{outgoing.rate4xx.toFixed(2)}</td>
                  <td>{outgoing.rate5xx.toFixed(2)}</td>
                  <td>{outgoing.percentErr.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <ErrorRatePieChart percentError={outgoing.percentErr} />
          </div>
          <div style={{ fontSize: '1.2em' }}>
            {this.renderIncomingRpsChart()}
            {this.renderOutgoingRpsChart()}
          </div>
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
          color="green"
        />
      ));
  };

  renderIncomingRpsChart = () => {
    return (
      <RpsChart label="Incoming" dataRps={[350, 400, 150, 850, 50, 220]} dataErrors={[140, 100, 50, 700, 10, 110]} />
    );
  };

  renderOutgoingRpsChart = () => {
    return <RpsChart label="Outgoing" dataRps={[350, 400, 150]} dataErrors={[140, 100, 130]} />;
  };
}
