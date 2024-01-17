import * as React from 'react';
import { Tab, Tooltip } from '@patternfly/react-core';
import { Edge, GraphElement, Node } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { summaryFont, summaryBodyTabs, summaryPanelWidth, getTitle, noTrafficStyle } from './SummaryPanelCommon';
import { RateTableGrpc, RateTableHttp, RateTableTcp } from 'components/SummaryPanel/RateTable';
import { SimpleTabs } from 'components/Tab/SimpleTabs';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { SummaryPanelPropType, NodeType, TrafficRate, NodeAttr } from 'types/Graph';
import {
  getAccumulatedTrafficRateGrpc,
  getAccumulatedTrafficRateHttp,
  getAccumulatedTrafficRateTcp,
  TrafficRateGrpc,
  TrafficRateHttp,
  TrafficRateTcp
} from 'utils/TrafficRate';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { descendents, edgesIn, edgesInOut, edgesOut, elems, select } from 'pages/GraphPF/GraphPFElems';
import { panelHeadingStyle, panelStyle } from './SummaryPanelStyle';
import { kialiIconDark, kialiIconLight, serverConfig } from '../../config';
import { KialiInstance } from '../../types/Mesh';
import { getKialiTheme } from 'utils/ThemeUtils';
import { Theme } from '../../types/Common';

type SummaryPanelClusterBoxState = {
  clusterBox: any;
};

const defaultState: SummaryPanelClusterBoxState = {
  clusterBox: null
};

const topologyStyle = kialiStyle({
  marginLeft: '0.25rem',
  marginRight: '0.5rem'
});

const kialiIconStyle = kialiStyle({
  width: '1rem',
  marginRight: '0.25rem'
});

export class SummaryPanelClusterBox extends React.Component<SummaryPanelPropType, SummaryPanelClusterBoxState> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: summaryPanelWidth,
    overflowY: 'auto' as 'auto',
    backgroundColor: PFColors.BackgroundColor100,
    width: summaryPanelWidth
  };

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = { ...defaultState };
  }

  static getDerivedStateFromProps(
    props: SummaryPanelPropType,
    state: SummaryPanelClusterBoxState
  ): SummaryPanelClusterBoxState | null {
    // if the summaryTarget (i.e. graph) has changed, then init the state
    return props.data.summaryTarget !== state.clusterBox ? { clusterBox: props.data.summaryTarget } : null;
  }

  render(): React.ReactNode {
    const isPF = !!this.props.data.isPF;
    const clusterBox = this.props.data.summaryTarget;
    const data = isPF ? clusterBox.getData() : clusterBox.data();
    const boxed = isPF ? descendents(clusterBox) : clusterBox.descendants();
    const cluster = data[NodeAttr.cluster];
    const kialiInstances = serverConfig.clusters[cluster] ? serverConfig.clusters[cluster].kialiInstances : [];

    let numSvc: number;
    let numWorkloads: number;
    let numEdges: number;

    const { numApps, numVersions } = this.countApps(boxed, isPF);
    const {
      grpcIn,
      grpcOut,
      grpcTotal,
      httpIn,
      httpOut,
      httpTotal,
      isGrpcRequests,
      tcpIn,
      tcpOut,
      tcpTotal
    } = this.getBoxTraffic(boxed, isPF);

    if (isPF) {
      numSvc = select(boxed, { prop: NodeAttr.nodeType, val: NodeType.SERVICE }).length;
      numWorkloads = select(boxed, { prop: NodeAttr.nodeType, val: NodeType.WORKLOAD }).length;
      numEdges = edgesInOut(boxed).length;
    } else {
      numSvc = boxed.filter(`node[nodeType = "${NodeType.SERVICE}"]`).size();
      numWorkloads = boxed.filter(`node[nodeType = "${NodeType.WORKLOAD}"]`).size();
      numEdges = boxed.connectedEdges().size();
    }

    const tooltipInboundRef = React.createRef();
    const tooltipOutboundRef = React.createRef();
    const tooltipTotalRef = React.createRef();

    return (
      <div className={panelStyle} style={SummaryPanelClusterBox.panelStyle}>
        <div className={panelHeadingStyle}>
          {getTitle('Cluster')}
          {this.renderCluster(cluster, kialiInstances)}
          {this.renderTopologySummary(numSvc, numWorkloads, numApps, numVersions, numEdges)}
        </div>

        <div className={summaryBodyTabs}>
          <SimpleTabs id="graph_summary_tabs" defaultTab={0} style={{ paddingBottom: '0.5rem' }}>
            <Tooltip
              id="tooltip-inbound"
              content="Traffic entering from another cluster."
              entryDelay={1250}
              triggerRef={tooltipInboundRef}
            />
            <Tooltip
              id="tooltip-outbound"
              content="Traffic exiting to another cluster."
              entryDelay={1250}
              triggerRef={tooltipOutboundRef}
            />
            <Tooltip
              id="tooltip-total"
              content="All inbound, outbound and internal cluster traffic."
              entryDelay={1250}
              triggerRef={tooltipTotalRef}
            />
            <Tab style={summaryFont} title="Inbound" eventKey={0} ref={tooltipInboundRef}>
              <div style={summaryFont}>
                {grpcIn.rate === 0 && httpIn.rate === 0 && tcpIn.rate === 0 && (
                  <div className={noTrafficStyle}>
                    <KialiIcon.Info /> No inbound traffic.
                  </div>
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
                  <div className={noTrafficStyle}>
                    <KialiIcon.Info /> No outbound traffic.
                  </div>
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
                  <div className={noTrafficStyle}>
                    <KialiIcon.Info /> No traffic.
                  </div>
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

  private getBoxTraffic = (
    boxed: any,
    isPF: boolean
  ): {
    grpcIn: TrafficRateGrpc;
    grpcOut: TrafficRateGrpc;
    grpcTotal: TrafficRateGrpc;
    httpIn: TrafficRateHttp;
    httpOut: TrafficRateHttp;
    httpTotal: TrafficRateHttp;
    isGrpcRequests: boolean;
    tcpIn: TrafficRateTcp;
    tcpOut: TrafficRateTcp;
    tcpTotal: TrafficRateTcp;
  } => {
    const clusterBox = this.props.data.summaryTarget;
    const data = isPF ? clusterBox.getData() : clusterBox.data();
    const cluster = data[NodeAttr.cluster];

    let inboundEdges: Edge[] | any;
    let outboundEdges: Edge[] | any;
    let totalEdges: Edge[] | any;

    if (isPF) {
      const controller = (clusterBox as Node).getController();
      const { nodes } = elems(controller);
      const outsideNodes = select(nodes, { prop: NodeAttr.cluster, op: '!=', val: cluster }) as Node[];
      // inbound edges are from a different cluster
      inboundEdges = edgesOut(outsideNodes, boxed);
      // outbound edges are to a different different cluster
      outboundEdges = edgesIn(outsideNodes, boxed);
      // total edges are inbound + edges from boxed workload|app|root nodes (i.e. not injected service nodes or box nodes)
      totalEdges = [...inboundEdges];
      totalEdges.push(...edgesOut(select(boxed, { prop: NodeAttr.workload, op: 'truthy' }) as Node[]));
    } else {
      // inbound edges are from a different cluster
      inboundEdges = clusterBox.cy().nodes(`[${NodeAttr.cluster} != "${cluster}"]`).edgesTo(boxed);
      // outbound edges are to a different cluster
      outboundEdges = boxed.edgesTo(`[${NodeAttr.cluster} != "${cluster}"]`);
      // total edges are inbound + edges from boxed workload|app|root nodes (i.e. not injected service nodes or box nodes)
      totalEdges = inboundEdges.add(boxed.filter(`[?${NodeAttr.workload}]`).edgesTo('*'));
    }

    return {
      grpcIn: getAccumulatedTrafficRateGrpc(inboundEdges, isPF),
      grpcOut: getAccumulatedTrafficRateGrpc(outboundEdges, isPF),
      grpcTotal: getAccumulatedTrafficRateGrpc(totalEdges, isPF),
      httpIn: getAccumulatedTrafficRateHttp(inboundEdges, isPF),
      httpOut: getAccumulatedTrafficRateHttp(outboundEdges, isPF),
      httpTotal: getAccumulatedTrafficRateHttp(totalEdges, isPF),
      isGrpcRequests: this.props.trafficRates.includes(TrafficRate.GRPC_REQUEST),
      tcpIn: getAccumulatedTrafficRateTcp(inboundEdges, isPF),
      tcpOut: getAccumulatedTrafficRateTcp(outboundEdges, isPF),
      tcpTotal: getAccumulatedTrafficRateTcp(totalEdges, isPF)
    };
  };

  private countApps = (boxed: any, isPF: boolean): { numApps: number; numVersions: number } => {
    if (isPF) {
      return this.countAppsPF(boxed);
    }

    const appVersions: { [key: string]: Set<string> } = {};

    boxed.filter(`node[nodeType = "${NodeType.APP}"]`).forEach((node: any) => {
      const app = node.data(NodeAttr.app);

      if (appVersions[app] === undefined) {
        appVersions[app] = new Set();
      }

      appVersions[app].add(node.data(NodeAttr.version));
    });

    return {
      numApps: Object.getOwnPropertyNames(appVersions).length,
      numVersions: Object.getOwnPropertyNames(appVersions).reduce((totalCount: number, version: string) => {
        return totalCount + appVersions[version].size;
      }, 0)
    };
  };

  private countAppsPF = (boxed: any): { numApps: number; numVersions: number } => {
    const appVersions: { [key: string]: Set<string> } = {};

    select(boxed, { prop: NodeAttr.nodeType, val: NodeType.APP }).forEach((node: GraphElement) => {
      const data = node.getData();
      const app = data[NodeAttr.app];

      if (appVersions[app] === undefined) {
        appVersions[app] = new Set();
      }

      appVersions[app].add(data[NodeAttr.version]);
    });

    return {
      numApps: Object.getOwnPropertyNames(appVersions).length,
      numVersions: Object.getOwnPropertyNames(appVersions).reduce((totalCount: number, version: string) => {
        return totalCount + appVersions[version].size;
      }, 0)
    };
  };

  private renderCluster = (cluster: string, kialiInstances: KialiInstance[]): React.ReactNode => {
    return (
      <React.Fragment key={cluster}>
        <PFBadge badge={PFBadges.Cluster} size="sm" />
        {cluster}
        {this.renderKialiLinks(kialiInstances)}
      </React.Fragment>
    );
  };

  private renderKialiLinks = (kialiInstances: KialiInstance[]): React.ReactNode => {
    const kialiIcon = getKialiTheme() === Theme.DARK ? kialiIconDark : kialiIconLight;

    return kialiInstances.map(instance => {
      if (instance.url.length !== 0) {
        return (
          <div>
            <img alt="Kiali Icon" src={kialiIcon} className={kialiIconStyle} />
            <a href={instance.url} target="_blank" rel="noopener noreferrer">
              {instance.namespace} {' / '} {instance.serviceName}
            </a>
          </div>
        );
      } else {
        return (
          <div>
            <img alt="Kiali Icon" src={kialiIcon} className={kialiIconStyle} />
            {`${instance.namespace} / ${instance.serviceName}`}
          </div>
        );
      }
    });
  };

  private renderTopologySummary = (
    numSvc: number,
    numWorkloads: number,
    numApps: number,
    numVersions: number,
    numEdges: number
  ): React.ReactNode => (
    <div style={{ marginTop: '1rem' }}>
      {getTitle('Current Graph')}

      {numApps > 0 && (
        <div>
          <KialiIcon.Applications className={topologyStyle} />
          {numApps.toString()} {numApps === 1 ? 'app ' : 'apps '}
          {numVersions > 0 && `(${numVersions} versions)`}
        </div>
      )}

      {numSvc > 0 && (
        <div>
          <KialiIcon.Services className={topologyStyle} />
          {numSvc.toString()} {numSvc === 1 ? 'service' : 'services'}
        </div>
      )}

      {numWorkloads > 0 && (
        <div>
          <KialiIcon.Workloads className={topologyStyle} />
          {numWorkloads.toString()} {numWorkloads === 1 ? 'workload' : 'workloads'}
        </div>
      )}

      {numEdges > 0 && (
        <div>
          <KialiIcon.Topology className={topologyStyle} />
          {numEdges.toString()} {numEdges === 1 ? 'edge' : 'edges'}
        </div>
      )}
    </div>
  );
}
