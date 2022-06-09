import * as React from 'react';
import { Tab, Tooltip } from '@patternfly/react-core';
import { style } from 'typestyle';
import { summaryFont, summaryHeader, summaryBodyTabs, summaryPanelWidth, getTitle } from './SummaryPanelCommon';
import { CyNode } from 'components/CytoscapeGraph/CytoscapeGraphUtils';
import KialiPageLink from 'components/Link/KialiPageLink';
import { RateTableGrpc, RateTableHttp, RateTableTcp } from 'components/SummaryPanel/RateTable';
import SimpleTabs from 'components/Tab/SimpleTabs';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { SummaryPanelPropType, NodeType, TrafficRate } from 'types/Graph';
import {
  getAccumulatedTrafficRateGrpc,
  getAccumulatedTrafficRateHttp,
  getAccumulatedTrafficRateTcp
} from 'utils/TrafficRate';
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
    minWidth: summaryPanelWidth,
    overflowY: 'auto' as 'auto',
    backgroundColor: PFColors.White,
    width: summaryPanelWidth
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
    const grpcIn = getAccumulatedTrafficRateGrpc(inboundEdges);
    const grpcOut = getAccumulatedTrafficRateGrpc(outboundEdges);
    const grpcTotal = getAccumulatedTrafficRateGrpc(totalEdges);
    const httpIn = getAccumulatedTrafficRateHttp(inboundEdges);
    const httpOut = getAccumulatedTrafficRateHttp(outboundEdges);
    const httpTotal = getAccumulatedTrafficRateHttp(totalEdges);
    const isGrpcRequests = this.props.trafficRates.includes(TrafficRate.GRPC_REQUEST);
    const tcpIn = getAccumulatedTrafficRateTcp(inboundEdges);
    const tcpOut = getAccumulatedTrafficRateTcp(outboundEdges);
    const tcpTotal = getAccumulatedTrafficRateTcp(totalEdges);

    const tooltipInboundRef = React.createRef();
    const tooltipOutboundRef = React.createRef();
    const tooltipTotalRef = React.createRef();

    return (
      <div className="panel panel-default" style={SummaryPanelClusterBox.panelStyle}>
        <div className="panel-heading" style={summaryHeader}>
          {getTitle('Cluster')}
          {this.renderCluster(cluster)}
          {this.renderTopologySummary(numSvc, numWorkloads, numApps, numVersions, numEdges)}
        </div>
        <div className={summaryBodyTabs}>
          <SimpleTabs id="graph_summary_tabs" defaultTab={0} style={{ paddingBottom: '10px' }}>
            <Tooltip
              id="tooltip-inbound"
              content="Traffic entering from another cluster."
              entryDelay={1250}
              reference={tooltipInboundRef}
            />
            <Tooltip
              id="tooltip-outbound"
              content="Traffic exiting to another cluster."
              entryDelay={1250}
              reference={tooltipOutboundRef}
            />
            <Tooltip
              id="tooltip-total"
              content="All inbound, outbound and internal cluster traffic."
              entryDelay={1250}
              reference={tooltipTotalRef}
            />
            <Tab style={summaryFont} title="Inbound" eventKey={0} ref={tooltipInboundRef}>
              <div style={summaryFont}>
                {grpcIn.rate === 0 && httpIn.rate === 0 && tcpIn.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No inbound traffic.
                  </>
                )}
                {grpcIn.rate > 0 && (
                  <RateTableGrpc
                    isRequests={isGrpcRequests}
                    rate={grpcIn.rate}
                    rateGrpcErr={grpcIn.rateGrpcErr}
                    rateNR={grpcIn.rateNoResponse}
                  />
                )}
                {httpIn.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={httpIn.rate}
                    rate3xx={httpIn.rate3xx}
                    rate4xx={httpIn.rate4xx}
                    rate5xx={httpIn.rate5xx}
                    rateNR={httpIn.rateNoResponse}
                  />
                )}
                {tcpIn.rate > 0 && <RateTableTcp rate={tcpIn.rate} />}
                {
                  // We don't show a sparkline here because we need to aggregate the traffic of an
                  // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                }
              </div>
            </Tab>
            <Tab style={summaryFont} title="Outbound" eventKey={1} ref={tooltipOutboundRef}>
              <div style={summaryFont}>
                {grpcOut.rate === 0 && httpOut.rate === 0 && tcpOut.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No outbound traffic.
                  </>
                )}
                {grpcOut.rate > 0 && (
                  <RateTableGrpc
                    isRequests={isGrpcRequests}
                    rate={grpcOut.rate}
                    rateGrpcErr={grpcOut.rateGrpcErr}
                    rateNR={grpcOut.rateNoResponse}
                  />
                )}
                {httpOut.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={httpOut.rate}
                    rate3xx={httpOut.rate3xx}
                    rate4xx={httpOut.rate4xx}
                    rate5xx={httpOut.rate5xx}
                    rateNR={httpOut.rateNoResponse}
                  />
                )}
                {tcpOut.rate > 0 && <RateTableTcp rate={tcpOut.rate} />}
                {
                  // We don't show a sparkline here because we need to aggregate the traffic of an
                  // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                }
              </div>
            </Tab>
            <Tab style={summaryFont} title="Total" eventKey={2} ref={tooltipTotalRef}>
              <div style={summaryFont}>
                {grpcTotal.rate === 0 && httpTotal.rate === 0 && tcpTotal.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No traffic.
                  </>
                )}
                {grpcTotal.rate > 0 && (
                  <RateTableGrpc
                    isRequests={isGrpcRequests}
                    rate={grpcTotal.rate}
                    rateGrpcErr={grpcTotal.rateGrpcErr}
                    rateNR={grpcTotal.rateNoResponse}
                  />
                )}
                {httpTotal.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={httpTotal.rate}
                    rate3xx={httpTotal.rate3xx}
                    rate4xx={httpTotal.rate4xx}
                    rate5xx={httpTotal.rate5xx}
                    rateNR={httpTotal.rateNoResponse}
                  />
                )}
                {tcpTotal.rate > 0 && <RateTableTcp rate={tcpTotal.rate} />}
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
          <PFBadge badge={PFBadges.Cluster} size="sm" style={{ marginBottom: '2px' }} />
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
      {getTitle('Current Graph')}
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
