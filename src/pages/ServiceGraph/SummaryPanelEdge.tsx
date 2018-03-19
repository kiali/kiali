import * as React from 'react';
import ServiceInfoBadge from '../../pages/ServiceDetails/ServiceInfo/ServiceInfoBadge';
import { RateTable } from '../../components/SummaryPanel/RateTable';
import { RpsChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';

export default class SummaryPanelEdge extends React.Component<SummaryPanelPropType> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    bottom: 0,
    top: 0,
    right: 0
  };

  render() {
    const edge = this.props.data.summaryTarget;
    const source = edge.source();
    const sourceSplit = source.data('service').split('.');
    const sourceService = sourceSplit[0];
    const sourceNamespace = sourceSplit.length < 2 ? 'unknown' : sourceSplit[1];
    const sourceVersion = source.data('version');
    const dest = edge.target();
    const destSplit = dest.data('service').split('.');
    const destService = destSplit[0];
    const destNamespace = destSplit[1];
    const destVersion = dest.data('version');
    const rate = this.safeRate(edge.data('rate'));
    const rate3xx = this.safeRate(edge.data('rate3XX'));
    const rate4xx = this.safeRate(edge.data('rate4XX'));
    const rate5xx = this.safeRate(edge.data('rate5XX'));
    const sourceLink = <a href={`../namespaces/${sourceNamespace}/services/${sourceService}`}>{sourceService}</a>;
    const destLink = <a href={`../namespaces/${destNamespace}/services/${destService}`}>{destService}</a>;

    return (
      <div className="panel panel-default" style={SummaryPanelEdge.panelStyle}>
        <div className="panel-heading">Edge Source: {sourceLink}</div>
        <div className="panel-body">
          <p>{this.renderLabels(sourceNamespace, sourceVersion)}</p>
        </div>
        <div className="panel-heading">Edge Dest: {destLink}</div>
        <div className="panel-body">
          <p>{this.renderLabels(destNamespace, destVersion)}</p>
          <hr />
          <RateTable
            title="Traffic (requests per second):"
            rate={rate}
            rate3xx={rate3xx}
            rate4xx={rate4xx}
            rate5xx={rate5xx}
          />
          <div style={{ fontSize: '1.2em' }}>
            <hr />
            {this.renderRpsChart()}
          </div>
        </div>
      </div>
    );
  }

  safeRate = (s: string) => {
    return s === undefined ? 0.0 : parseFloat(s);
  };

  renderLabels = (ns: string, ver: string) => (
    <>
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="namespace" rightText={ns} color="green" />
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="version" rightText={ver} color="green" />
    </>
  );

  renderRpsChart = () => {
    return <RpsChart label="MOCK" dataRps={[350, 400, 150, 850, 50, 220]} dataErrors={[140, 100, 50, 700, 10, 110]} />;
  };
}
