import * as React from 'react';
import { Tab } from '@patternfly/react-core';
import { style } from 'typestyle';
import { summaryFont, summaryHeader, summaryBodyTabs } from './SummaryPanelCommon';
import { CyNode } from 'components/CytoscapeGraph/CytoscapeGraphUtils';
import KialiPageLink from 'components/Link/KialiPageLink';
import { RateTableGrpc, RateTableHttp } from 'components/SummaryPanel/RateTable';
import SimpleTabs from 'components/Tab/SimpleTabs';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { SummaryPanelPropType, NodeType } from 'types/Graph';
import { getAccumulatedTrafficRateGrpc, getAccumulatedTrafficRateHttp } from 'utils/TrafficRate';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';

type SummaryPanelClusterBoxState = {
  clusterBox: any;
};

const defaultState: SummaryPanelClusterBoxState = {
  clusterBox: null
};

const topologyStyle = style({
  margin: '0 1em'
});

export default class SummaryPanelClusterBox extends React.Component<SummaryPanelPropType, SummaryPanelClusterBoxState> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: '25em',
    overflowY: 'auto' as 'auto',
    backgroundColor: PFColors.White,
    width: '25em'
  };

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = { ...defaultState };
  }

  static getDerivedStateFromProps(props: SummaryPanelPropType, state: SummaryPanelClusterBoxState) {
    // if the summaryTarget (i.e. graph) has changed, then init the state
    return props.data.summaryTarget !== state.clusterBox ? { clusterBox: props.data.summaryTarget } : null;
  }

  render() {
    const clusterBox = this.props.data.summaryTarget;
    const boxed = clusterBox.descendants();
    const cluster = clusterBox.data(CyNode.cluster);

    const numSvc = boxed.filter(`node[nodeType = "${NodeType.SERVICE}"]`).size();
    const numWorkloads = boxed.filter(`node[nodeType = "${NodeType.WORKLOAD}"]`).size();
    const { numApps, numVersions } = this.countApps(boxed);
    const numEdges = boxed.connectedEdges().size();
    // inbound edges are from a different cluster
    const inboundEdges = clusterBox.cy().nodes(`[${CyNode.cluster} != "${cluster}"]`).edgesTo(boxed);
    // outbound edges are to a different cluster
    const outboundEdges = boxed.edgesTo(`[${CyNode.cluster} != "${cluster}"]`);
    // total edges are inbound + edges from boxed workload|app|root nodes (i.e. not injected service nodes or box nodes)
    const totalEdges = inboundEdges.add(boxed.filter(`[?${CyNode.workload}]`).edgesTo('*'));
    const totalRateGrpc = getAccumulatedTrafficRateGrpc(totalEdges);
    const totalRateHttp = getAccumulatedTrafficRateHttp(totalEdges);
    const inboundRateGrpc = getAccumulatedTrafficRateGrpc(inboundEdges);
    const inboundRateHttp = getAccumulatedTrafficRateHttp(inboundEdges);
    const outboundRateGrpc = getAccumulatedTrafficRateGrpc(outboundEdges);
    const outboundRateHttp = getAccumulatedTrafficRateHttp(outboundEdges);
    return (
      <div className="panel panel-default" style={SummaryPanelClusterBox.panelStyle}>
        <div className="panel-heading" style={summaryHeader}>
          {this.renderCluster(cluster)}
          {this.renderTopologySummary(numSvc, numWorkloads, numApps, numVersions, numEdges)}
        </div>
        <div className={summaryBodyTabs}>
          <SimpleTabs id="graph_summary_tabs" defaultTab={0} style={{ paddingBottom: '10px' }}>
            <Tab style={summaryFont} title="Inbound" eventKey={0}>
              <div style={summaryFont}>
                {inboundRateGrpc.rate === 0 && inboundRateHttp.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No inbound traffic.
                  </>
                )}
                {inboundRateGrpc.rate > 0 && (
                  <RateTableGrpc
                    title="GRPC Traffic (requests per second):"
                    rate={inboundRateGrpc.rate}
                    rateGrpcErr={inboundRateGrpc.rateGrpcErr}
                    rateNR={inboundRateGrpc.rateNoResponse}
                  />
                )}
                {inboundRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={inboundRateHttp.rate}
                    rate3xx={inboundRateHttp.rate3xx}
                    rate4xx={inboundRateHttp.rate4xx}
                    rate5xx={inboundRateHttp.rate5xx}
                    rateNR={inboundRateHttp.rateNoResponse}
                  />
                )}
                {
                  // We don't show a sparkline here because we need to aggregate the traffic of an
                  // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                }
              </div>
            </Tab>
            <Tab style={summaryFont} title="Outbound" eventKey={1}>
              <div style={summaryFont}>
                {outboundRateGrpc.rate === 0 && outboundRateHttp.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No outbound traffic.
                  </>
                )}
                {outboundRateGrpc.rate > 0 && (
                  <RateTableGrpc
                    title="GRPC Traffic (requests per second):"
                    rate={outboundRateGrpc.rate}
                    rateGrpcErr={outboundRateGrpc.rateGrpcErr}
                    rateNR={outboundRateGrpc.rateNoResponse}
                  />
                )}
                {outboundRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={outboundRateHttp.rate}
                    rate3xx={outboundRateHttp.rate3xx}
                    rate4xx={outboundRateHttp.rate4xx}
                    rate5xx={outboundRateHttp.rate5xx}
                    rateNR={outboundRateHttp.rateNoResponse}
                  />
                )}
                {
                  // We don't show a sparkline here because we need to aggregate the traffic of an
                  // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                }
              </div>
            </Tab>
            <Tab style={summaryFont} title="Total" eventKey={2}>
              <div style={summaryFont}>
                {totalRateGrpc.rate === 0 && totalRateHttp.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No traffic.
                  </>
                )}
                {totalRateGrpc.rate > 0 && (
                  <RateTableGrpc
                    title="GRPC Traffic (requests per second):"
                    rate={totalRateGrpc.rate}
                    rateGrpcErr={totalRateGrpc.rateGrpcErr}
                    rateNR={totalRateGrpc.rateNoResponse}
                  />
                )}
                {totalRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={totalRateHttp.rate}
                    rate3xx={totalRateHttp.rate3xx}
                    rate4xx={totalRateHttp.rate4xx}
                    rate5xx={totalRateHttp.rate5xx}
                    rateNR={totalRateHttp.rateNoResponse}
                  />
                )}
              </div>
            </Tab>
          </SimpleTabs>
        </div>
      </div>
    );
  }

  private countApps = (boxed): { numApps: number; numVersions: number } => {
    const appVersions: { [key: string]: Set<string> } = {};

    boxed.filter(`node[nodeType = "${NodeType.APP}"]`).forEach(node => {
      const app = node.data(CyNode.app);
      if (appVersions[app] === undefined) {
        appVersions[app] = new Set();
      }
      appVersions[app].add(node.data(CyNode.version));
    });

    return {
      numApps: Object.getOwnPropertyNames(appVersions).length,
      numVersions: Object.getOwnPropertyNames(appVersions).reduce((totalCount: number, version: string) => {
        return totalCount + appVersions[version].size;
      }, 0)
    };
  };

  private renderCluster = (cluster: string) => {
    return (
      <React.Fragment key={cluster}>
        <span>
          <PFBadge badge={PFBadges.Cluster} style={{ marginBottom: '2px' }} />
          <KialiPageLink href="/" cluster={cluster}>
            {cluster}
          </KialiPageLink>{' '}
        </span>
        <br />
      </React.Fragment>
    );
  };

  private renderTopologySummary = (
    numSvc: number,
    numWorkloads: number,
    numApps: number,
    numVersions: number,
    numEdges: number
  ) => (
    <>
      <br />
      <strong>Current Graph:</strong>
      <br />
      {numApps > 0 && (
        <>
          <KialiIcon.Applications className={topologyStyle} />
          {numApps.toString()} {numApps === 1 ? 'app ' : 'apps '}
          {numVersions > 0 && `(${numVersions} versions)`}
          <br />
        </>
      )}
      {numSvc > 0 && (
        <>
          <KialiIcon.Services className={topologyStyle} />
          {numSvc.toString()} {numSvc === 1 ? 'service' : 'services'}
          <br />
        </>
      )}
      {numWorkloads > 0 && (
        <>
          <KialiIcon.Workloads className={topologyStyle} />
          {numWorkloads.toString()} {numWorkloads === 1 ? 'workload' : 'workloads'}
          <br />
        </>
      )}
      {numEdges > 0 && (
        <>
          <KialiIcon.Topology className={topologyStyle} />
          {numEdges.toString()} {numEdges === 1 ? 'edge' : 'edges'}
        </>
      )}
    </>
  );
}
