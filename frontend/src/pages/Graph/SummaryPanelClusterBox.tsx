import * as React from 'react';
import { Tab, Tooltip } from '@patternfly/react-core';
import { Node } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { summaryFont, summaryBodyTabs, summaryPanelWidth, getTitle } from './SummaryPanelCommon';
import { RateTableGrpc, RateTableHttp, RateTableTcp } from 'components/SummaryPanel/RateTable';
import { SimpleTabs } from 'components/Tab/SimpleTabs';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { SummaryPanelPropType, NodeType, TrafficRate, NodeAttr } from 'types/Graph';
import {
  getAccumulatedTrafficRateGrpc,
  getAccumulatedTrafficRateHttp,
  getAccumulatedTrafficRateTcp
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
  margin: '0 1em'
});

const kialiIconStyle = kialiStyle({
  width: '15px',
  marginRight: '5px'
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

  static getDerivedStateFromProps(props: SummaryPanelPropType, state: SummaryPanelClusterBoxState) {
    // if the summaryTarget (i.e. graph) has changed, then init the state
    return props.data.summaryTarget !== state.clusterBox ? { clusterBox: props.data.summaryTarget } : null;
  }

  render() {
    const isPF = !!this.props.data.isPF;
    const clusterBox = this.props.data.summaryTarget;
    const data = isPF ? clusterBox.getData() : clusterBox.data();
    const boxed = isPF ? descendents(clusterBox) : clusterBox.descendants();
    const cluster = data[NodeAttr.cluster];
    const kialiInstances = serverConfig.clusters[cluster] ? serverConfig.clusters[cluster].kialiInstances : [];

    let numSvc;
    let numWorkloads;
    let numEdges;
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
          {getTitle($t('Cluster'))}
          {this.renderCluster(cluster, kialiInstances)}
          {this.renderTopologySummary(numSvc, numWorkloads, numApps, numVersions, numEdges)}
        </div>
        <div className={summaryBodyTabs}>
          <SimpleTabs id="graph_summary_tabs" defaultTab={0} style={{ paddingBottom: '10px' }}>
            <Tooltip
              id="tooltip-inbound"
              content={$t('tip53', 'Traffic entering from another cluster.')}
              entryDelay={1250}
              triggerRef={tooltipInboundRef}
            />
            <Tooltip
              id="tooltip-outbound"
              content={$t('tip54', 'Traffic exiting to another cluster.')}
              entryDelay={1250}
              triggerRef={tooltipOutboundRef}
            />
            <Tooltip
              id="tooltip-total"
              content={$t('tip55', 'All inbound, outbound and internal cluster traffic.')}
              entryDelay={1250}
              triggerRef={tooltipTotalRef}
            />
            <Tab style={summaryFont} title={$t('"Inbound"')} eventKey={0} ref={tooltipInboundRef}>
              <div style={summaryFont}>
                {grpcIn.rate === 0 && httpIn.rate === 0 && tcpIn.rate === 0 && (
                  <>
                    <KialiIcon.Info /> {$t('tip282', 'No inbound traffic.')}
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
                    title={`${$t('title15', 'HTTP (requests per second)')}:`}
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
            <Tab style={summaryFont} title={$t('Outbound')} eventKey={1} ref={tooltipOutboundRef}>
              <div style={summaryFont}>
                {grpcOut.rate === 0 && httpOut.rate === 0 && tcpOut.rate === 0 && (
                  <>
                    <KialiIcon.Info /> {$t('tip283', 'No outbound traffic.')}
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
                    title={`${$t('title15', 'HTTP (requests per second)')}:`}
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
            <Tab style={summaryFont} title={$t('Total')} eventKey={2} ref={tooltipTotalRef}>
              <div style={summaryFont}>
                {grpcTotal.rate === 0 && httpTotal.rate === 0 && tcpTotal.rate === 0 && (
                  <>
                    <KialiIcon.Info /> {$t('tip284', 'No traffic.')}
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
                    title={`${$t('title15', 'HTTP (requests per second)')}:`}
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
    boxed,
    isPF: boolean
  ): { grpcIn; grpcOut; grpcTotal; httpIn; httpOut; httpTotal; isGrpcRequests; tcpIn; tcpOut; tcpTotal } => {
    const clusterBox = this.props.data.summaryTarget;
    const data = isPF ? clusterBox.getData() : clusterBox.data();
    const cluster = data[NodeAttr.cluster];

    let inboundEdges;
    let outboundEdges;
    let totalEdges;
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

  private countApps = (boxed, isPF: boolean): { numApps: number; numVersions: number } => {
    if (isPF) {
      return this.countAppsPF(boxed);
    }

    const appVersions: { [key: string]: Set<string> } = {};

    boxed.filter(`node[nodeType = "${NodeType.APP}"]`).forEach(node => {
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

  private countAppsPF = (boxed): { numApps: number; numVersions: number } => {
    const appVersions: { [key: string]: Set<string> } = {};

    select(boxed, { prop: NodeAttr.nodeType, val: NodeType.APP }).forEach(node => {
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

  private renderCluster = (cluster: string, kialiInstances: KialiInstance[]) => {
    return (
      <React.Fragment key={cluster}>
        <PFBadge badge={PFBadges.Cluster} size="sm" style={{ marginBottom: '2px' }} />
        {cluster}
        <br />
        {this.renderKialiLinks(kialiInstances)}
      </React.Fragment>
    );
  };

  private renderKialiLinks = (kialiInstances: KialiInstance[]) => {
    const kialiIcon = getKialiTheme() === Theme.DARK ? kialiIconDark : kialiIconLight;
    return kialiInstances.map(instance => {
      if (instance.url.length !== 0) {
        return (
          <span>
            <img alt="Kiali Icon" src={kialiIcon} className={kialiIconStyle} />
            <a href={instance.url} target="_blank" rel="noopener noreferrer">
              {instance.namespace} {' / '} {instance.serviceName}
            </a>
            <br />
          </span>
        );
      } else {
        return (
          <span>
            <img alt="Kiali Icon" src={kialiIcon} className={kialiIconStyle} />
            {instance.namespace + ' / ' + instance.serviceName}
            <br />
          </span>
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
  ) => (
    <>
      <br />
      {getTitle($t('Current_Graph', 'Current Graph'))}
      {numApps > 0 && (
        <>
          <KialiIcon.Applications className={topologyStyle} />
          {numApps.toString()} {numApps === 1 ? $t('app') : $t('apps')}
          {numVersions > 0 && `(${numVersions} ${$t('versions')})`}
          <br />
        </>
      )}
      {numSvc > 0 && (
        <>
          <KialiIcon.Services className={topologyStyle} />
          {numSvc.toString()} {numSvc === 1 ? $t('service') : $t('services')}
          <br />
        </>
      )}
      {numWorkloads > 0 && (
        <>
          <KialiIcon.Workloads className={topologyStyle} />
          {numWorkloads.toString()} {numWorkloads === 1 ? $t('workload') : $t('workloads')}
          <br />
        </>
      )}
      {numEdges > 0 && (
        <>
          <KialiIcon.Topology className={topologyStyle} />
          {numEdges.toString()} {numEdges === 1 ? $t('edge') : $t('edges')}
        </>
      )}
    </>
  );
}
