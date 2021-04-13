import * as React from 'react';
import { Tab, Tooltip, TooltipPosition, Badge } from '@patternfly/react-core';
import { style } from 'typestyle';
import { RateTableGrpc, RateTableHttp } from '../../components/SummaryPanel/RateTable';
import { SummaryPanelPropType, NodeType } from '../../types/Graph';
import { getAccumulatedTrafficRateGrpc, getAccumulatedTrafficRateHttp } from '../../utils/TrafficRate';
import { summaryFont, summaryHeader, summaryBodyTabs } from './SummaryPanelCommon';
import { CyNode } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import SimpleTabs from 'components/Tab/SimpleTabs';
import { PFColors } from '../../components/Pf/PfColors';

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
    // incoming edges are from a different cluster, or from a local root node
    let incomingEdges = clusterBox.cy().nodes(`[${CyNode.cluster} != "${cluster}"]`).edgesTo(boxed);
    incomingEdges = incomingEdges.add(boxed.filter(`[?${CyNode.isRoot}]`).edgesTo('*'));
    // outgoing edges are to a different cluster
    const outgoingEdges = boxed.edgesTo(`[${CyNode.cluster} != "${cluster}"]`);
    // total edges are incoming + edges from boxed workload/app/root nodes (i.e. not injected service nodes or box nodes)
    const totalEdges = incomingEdges.add(boxed.filter(`[?${CyNode.workload}]`).edgesTo('*'));
    const totalRateGrpc = getAccumulatedTrafficRateGrpc(totalEdges);
    const totalRateHttp = getAccumulatedTrafficRateHttp(totalEdges);
    const incomingRateGrpc = getAccumulatedTrafficRateGrpc(incomingEdges);
    const incomingRateHttp = getAccumulatedTrafficRateHttp(incomingEdges);
    const outgoingRateGrpc = getAccumulatedTrafficRateGrpc(outgoingEdges);
    const outgoingRateHttp = getAccumulatedTrafficRateHttp(outgoingEdges);
    return (
      <div className="panel panel-default" style={SummaryPanelClusterBox.panelStyle}>
        <div className="panel-heading" style={summaryHeader}>
          {this.renderCluster(cluster)}
          {this.renderTopologySummary(numSvc, numWorkloads, numApps, numVersions, numEdges)}
        </div>
        <div className={summaryBodyTabs}>
          <SimpleTabs id="graph_summary_tabs" defaultTab={0} style={{ paddingBottom: '10px' }}>
            <Tab style={summaryFont} title="Incoming" eventKey={0}>
              <div style={summaryFont}>
                {incomingRateGrpc.rate === 0 && incomingRateHttp.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No incoming traffic.
                  </>
                )}
                {incomingRateGrpc.rate > 0 && (
                  <RateTableGrpc
                    title="GRPC Traffic (requests per second):"
                    rate={incomingRateGrpc.rate}
                    rateGrpcErr={incomingRateGrpc.rateGrpcErr}
                    rateNR={incomingRateGrpc.rateNoResponse}
                  />
                )}
                {incomingRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={incomingRateHttp.rate}
                    rate3xx={incomingRateHttp.rate3xx}
                    rate4xx={incomingRateHttp.rate4xx}
                    rate5xx={incomingRateHttp.rate5xx}
                    rateNR={incomingRateHttp.rateNoResponse}
                  />
                )}
                {
                  // We don't show a sparkline here because we need to aggregate the traffic of an
                  // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                }
              </div>
            </Tab>
            <Tab style={summaryFont} title="Outgoing" eventKey={1}>
              <div style={summaryFont}>
                {outgoingRateGrpc.rate === 0 && outgoingRateHttp.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No outgoing traffic.
                  </>
                )}
                {outgoingRateGrpc.rate > 0 && (
                  <RateTableGrpc
                    title="GRPC Traffic (requests per second):"
                    rate={outgoingRateGrpc.rate}
                    rateGrpcErr={outgoingRateGrpc.rateGrpcErr}
                    rateNR={outgoingRateGrpc.rateNoResponse}
                  />
                )}
                {outgoingRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={outgoingRateHttp.rate}
                    rate3xx={outgoingRateHttp.rate3xx}
                    rate4xx={outgoingRateHttp.rate4xx}
                    rate5xx={outgoingRateHttp.rate5xx}
                    rateNR={outgoingRateHttp.rateNoResponse}
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
          <Tooltip position={TooltipPosition.auto} content={<>Cluster</>}>
            <Badge className="virtualitem_badge_definition" style={{ marginBottom: '2px' }}>
              CL
            </Badge>
          </Tooltip>
          {cluster}{' '}
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
