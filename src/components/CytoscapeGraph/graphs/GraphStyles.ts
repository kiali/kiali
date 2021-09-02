import { style } from 'typestyle';
import { PFColors, PFColorVal, PFColorVals } from '../../../components/Pf/PfColors';
import { DEGRADED, FAILURE } from '../../../types/Health';
import {
  BoxByType,
  CytoscapeGlobalScratchData,
  CytoscapeGlobalScratchNamespace,
  EdgeLabelMode,
  GraphType,
  NodeType,
  numLabels,
  Protocol,
  TrafficRate,
  UNKNOWN
} from '../../../types/Graph';
import { icons } from '../../../config';
import NodeImageTopology from '../../../assets/img/node-background-topology.png';
import NodeImageKey from '../../../assets/img/node-background-key.png';
import { CyNode, decoratedEdgeData, decoratedNodeData } from '../CytoscapeGraphUtils';
import _ from 'lodash';
import * as Cy from 'cytoscape';
import { getEdgeHealth } from '../../../types/ErrorRate';
import { PFBadges } from 'components/Pf/PfBadges';
import { config } from 'config/Config';

export const DimClass = 'mousedim';
export const HighlightClass = 'mousehighlight';
export const HoveredClass = 'mousehover';

let EdgeColor: PFColorVal;
let EdgeColorDead: PFColorVal;
let EdgeColorDegraded: PFColorVal;
let EdgeColorFailure: PFColorVal;
let EdgeColorTCPWithTraffic: PFColorVal;
const EdgeIconMTLS = icons.istio.mtls.ascii; // lock
let EdgeTextOutlineColor: PFColorVal;
const EdgeTextOutlineWidth = '1px';
const EdgeTextFont = 'Verdana,Arial,Helvetica,sans-serif,pficon';
const EdgeTextFontSize = '6px';
const EdgeTextFontSizeHover = '10px';
const EdgeWidth = 2;
const EdgeWidthSelected = 4;
const NodeBorderWidth = '1px';
const NodeBorderWidthSelected = '3px';
let NodeColorBorder: PFColorVal;
let NodeColorBorderBox: PFColorVal;
let NodeColorBorderDegraded: PFColorVal;
let NodeColorBorderFailure: PFColorVal;
let NodeColorBorderHover: PFColorVal;
let NodeColorBorderSelected: PFColorVal;
let NodeColorFill: PFColorVal;
let NodeColorFillBoxApp: PFColorVal;
let NodeColorFillBoxCluster: PFColorVal;
let NodeColorFillBoxNamespace: PFColorVal;
let NodeColorFillHover: PFColorVal;
let NodeColorFillHoverDegraded: PFColorVal;
let NodeColorFillHoverFailure: PFColorVal;
const NodeHeight = '25px';
const NodeIconCB = icons.istio.circuitBreaker.className; // bolt
const NodeIconFaultInjection = icons.istio.faultInjection.className; // ban
const NodeIconGateway = icons.istio.gateway.className; // globe
const NodeIconMS = icons.istio.missingSidecar.className; // exclamation
const NodeIconRoot = icons.istio.root.className; // alt-arrow-circle-right
const NodeIconVS = icons.istio.virtualService.className; // code-branch
const NodeIconRequestRouting = icons.istio.requestRouting.className; // code-branch
const NodeIconRequestTimeout = icons.istio.requestTimeout.className; // clock
const NodeIconTrafficShifting = icons.istio.trafficShifting.className; // share-alt
const NodeIconWorkloadEntry = icons.istio.workloadEntry.className; // pf-icon-virtual-machine
const NodeTextColor = PFColors.Black1000;
const NodeTextColorBox = PFColors.White;
const NodeTextBackgroundColor = PFColors.White;
const NodeTextBackgroundColorBox = PFColors.Black700;
const NodeBadgeBackgroundColor = PFColors.Purple400;
const NodeBadgeColor = PFColors.White;
const NodeBadgeFontSize = '12px';
const NodeTextFont = EdgeTextFont;
const NodeTextFontSize = '8px';
const NodeTextFontSizeBox = '10px';
const NodeTextFontSizeHover = '11px';
const NodeTextFontSizeHoverBox = '13px';
const NodeWidth = NodeHeight;

// Puts a little more space between icons when a badge has multiple icons
const iconMargin = (existingIcons: string) =>
  existingIcons === '' ? style({ marginLeft: '1px' }) : style({ marginRight: '2px' });

const iconsDefault = style({
  alignItems: 'center',
  backgroundColor: NodeBadgeBackgroundColor,
  borderTopLeftRadius: '3px',
  borderBottomLeftRadius: '3px',
  color: NodeBadgeColor,
  display: 'flex',
  fontSize: NodeBadgeFontSize,
  padding: '3px 3px'
});

const contentBoxPfBadge = style({
  backgroundColor: PFColors.Badge,
  fontSize: NodeTextFontSizeBox,
  marginRight: '5px',
  minWidth: '24px', // reduce typical minWidth for badge to save label space
  paddingLeft: '0px',
  paddingRight: '0px'
});

const contentDefault = style({
  alignItems: 'center',
  backgroundColor: NodeTextBackgroundColor,
  borderRadius: '3px',
  borderWidth: '1px',
  color: NodeTextColor,
  display: 'flex',
  fontSize: NodeTextFontSize,
  padding: '3px 5px'
});

const contentBox = style({
  backgroundColor: NodeTextBackgroundColorBox,
  color: NodeTextColorBox,
  fontSize: NodeTextFontSizeBox
});

const contentWithBadges = style({
  borderBottomLeftRadius: 'unset',
  borderColor: NodeBadgeBackgroundColor,
  borderStyle: 'solid',
  borderTopLeftRadius: 'unset',
  borderLeft: '0'
});

const hostsClass = style({
  borderTop: `1px solid ${PFColors.Black600}`,
  textAlign: 'initial',
  fontSize: NodeTextFontSize,
  marginTop: '0.5em',
  paddingTop: '0.5em',
  $nest: {
    '& div:last-child': {
      display: 'none'
    },
    '&:hover div:last-child': {
      display: 'block'
    },
    '&:hover div:first-child': {
      display: 'none'
    }
  }
});

const labelDefault = style({
  borderRadius: '3px',
  boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.2), 0 2px 8px 0 rgba(0, 0, 0, 0.19)',
  display: 'inline-flex',
  fontFamily: NodeTextFont,
  fontSize: '0',
  fontWeight: 'normal',
  marginTop: '4px',
  lineHeight: '11px',
  textAlign: 'center'
});

const labelBox = style({
  marginTop: '13px'
});

export class GraphStyles {
  static runtimeColorsSet: boolean;

  // Our node color choices are defined by UX here:
  // - https://github.com/kiali/kiali/issues/2435#issuecomment-404640317
  // - https://github.com/kiali/kiali/issues/3675#issuecomment-807403919
  static setRuntimeColors = () => {
    if (GraphStyles.runtimeColorsSet) {
      return;
    }
    GraphStyles.runtimeColorsSet = true;

    EdgeColor = PFColorVals.Success;
    EdgeColorDead = PFColorVals.Black500;
    EdgeColorDegraded = PFColorVals.Warning;
    EdgeColorFailure = PFColorVals.Danger;
    EdgeColorTCPWithTraffic = PFColorVals.Blue600;
    EdgeTextOutlineColor = PFColorVals.White;
    NodeColorBorder = PFColorVals.Black400;
    NodeColorBorderBox = PFColorVals.Black600;
    NodeColorBorderDegraded = PFColorVals.Warning;
    NodeColorBorderFailure = PFColorVals.Danger;
    NodeColorBorderHover = PFColorVals.Blue300;
    NodeColorBorderSelected = PFColorVals.Blue300;
    NodeColorFill = PFColorVals.White;
    NodeColorFillBoxApp = PFColorVals.White;
    NodeColorFillBoxCluster = PFColorVals.Black200;
    NodeColorFillBoxNamespace = PFColorVals.Black100;
    NodeColorFillHover = PFColorVals.Blue50;
    NodeColorFillHoverDegraded = '#fdf2e5'; // roughly an Orange50 if it were defined
    NodeColorFillHoverFailure = '#ffe6e6'; // very close to Red50 if we want to change
  };

  static options() {
    return { wheelSensitivity: 0.1, autounselectify: false, autoungrabify: true };
  }

  static getNodeLabel(ele: Cy.NodeSingular) {
    const getCyGlobalData = (ele: Cy.NodeSingular): CytoscapeGlobalScratchData => {
      return ele.cy().scratch(CytoscapeGlobalScratchNamespace);
    };

    const cyGlobal = getCyGlobalData(ele);
    const node = decoratedNodeData(ele);
    const app = node.app || '';
    const cluster = node.cluster;
    const namespace = node.namespace;
    const nodeType = node.nodeType;
    const service = node.service || '';
    const version = node.version || '';
    const workload = node.workload || '';
    const isBox = node.isBox;
    const isBoxed = node.parent;
    const box1 = isBoxed ? ele.parent()[0] : undefined;
    const box1Type = box1 ? box1.data().isBox : undefined;
    const box2 = box1 && box1.parent() ? box1.parent()[0] : undefined;
    const box2Type = box2 ? box2.data().isBox : undefined;
    // const box3 = box2 && box2.parent() ? box2.parent()[0] : undefined;
    // const box3Type = box3 ? box3.data().isBox : undefined;
    const isAppBoxed = box1Type === BoxByType.APP;
    const isNamespaceBoxed = box1Type === BoxByType.NAMESPACE || box2Type === BoxByType.NAMESPACE;
    // const isClusterBoxed = box1Type === BoxByType.CLUSTER || box2Type === BoxByType.CLUSTER || box3Type === BoxByType.CLUSTER;
    const isMultiNamespace = cyGlobal.activeNamespaces.length > 1;
    const isOutside = node.isOutside;

    let icons = '';
    if (cyGlobal.showMissingSidecars && node.hasMissingSC) {
      icons = `<span class="${NodeIconMS} ${iconMargin(icons)}"></span> ${icons}`;
    }
    if (cyGlobal.showVirtualServices) {
      if (node.hasCB) {
        icons = `<span class="${NodeIconCB} ${iconMargin(icons)}"></span> ${icons}`;
      }
      // If there's an additional traffic scenario present then it's assumed
      // that there is a VS present so the VS badge is omitted.
      if (node.hasVS) {
        const hasKialiScenario =
          node.hasFaultInjection ||
          node.hasRequestRouting ||
          node.hasRequestTimeout ||
          node.hasTCPTrafficShifting ||
          node.hasTrafficShifting;
        if (!hasKialiScenario) {
          icons = `<span class="${NodeIconVS} ${iconMargin(icons)}"></span> ${icons}`;
        } else {
          if (node.hasFaultInjection) {
            icons = `<span class="${NodeIconFaultInjection} ${iconMargin(icons)}"></span> ${icons}`;
          }
          if (node.hasTrafficShifting || node.hasTCPTrafficShifting) {
            icons = `<span class="${NodeIconTrafficShifting} ${iconMargin(icons)}"></span> ${icons}`;
          }
          if (node.hasRequestTimeout) {
            icons = `<span class="${NodeIconRequestTimeout} ${iconMargin(icons)}"></span> ${icons}`;
          }
          if (node.hasRequestRouting) {
            icons = `<span class="${NodeIconRequestRouting} ${iconMargin(icons)}"></span> ${icons}`;
          }
        }
      }
    }

    if (node.hasWorkloadEntry) {
      icons = `<span class="${NodeIconWorkloadEntry} ${iconMargin(icons)}"></span> ${icons}`;
    }

    if (node.isRoot) {
      if (node.isGateway?.ingressInfo?.hostnames?.length !== undefined) {
        icons = `<span class='${NodeIconGateway} ${iconMargin(icons)}'></span> ${icons}`;
      }
      icons = `<span class='${NodeIconRoot} ${iconMargin(icons)}'></span> ${icons}`;
    }

    const hasIcon = icons.length > 0;
    if (hasIcon) {
      icons = `<div class=${iconsDefault}>${icons}</div>`;
    }

    let labelStyle = '';
    if (ele.hasClass(HighlightClass)) {
      labelStyle += 'font-size: ' + NodeTextFontSizeHover + ';';
    }
    if (ele.hasClass(DimClass)) {
      labelStyle += 'opacity: 0.6;';
    }

    let contentStyle = '';
    if (ele.hasClass(HighlightClass)) {
      const fontSize = isBox && isBox !== BoxByType.APP ? NodeTextFontSizeHoverBox : NodeTextFontSizeHover;
      contentStyle += 'font-size: ' + fontSize + ';';
    }

    const content: string[] = [];

    // append namespace if necessary
    if (
      (isMultiNamespace || isOutside) &&
      !!namespace &&
      namespace !== UNKNOWN &&
      !isAppBoxed &&
      !isNamespaceBoxed &&
      isBox !== BoxByType.NAMESPACE
    ) {
      content.push(`(${namespace})`);
    }

    // append cluster if necessary
    if (
      !!cluster &&
      cluster !== UNKNOWN &&
      cluster !== cyGlobal.homeCluster &&
      !isBoxed &&
      isBox !== BoxByType.CLUSTER
    ) {
      content.push(`(${cluster})`);
    }

    switch (nodeType) {
      case NodeType.AGGREGATE:
        content.unshift(node.aggregateValue!);
        break;
      case NodeType.APP:
        if (isAppBoxed) {
          if (cyGlobal.graphType === GraphType.APP) {
            content.unshift(app);
          } else if (version && version !== UNKNOWN) {
            content.unshift(version);
          } else {
            content.unshift(workload ? workload : app);
          }
        } else {
          if (cyGlobal.graphType === GraphType.APP || version === UNKNOWN) {
            content.unshift(app);
          } else {
            content.unshift(version);
            content.unshift(app);
          }
        }
        break;
      case NodeType.BOX:
        switch (isBox) {
          case BoxByType.APP:
            content.unshift(app);
            break;
          case BoxByType.CLUSTER:
            content.unshift(node.cluster);
            break;
          case BoxByType.NAMESPACE:
            content.unshift(node.namespace);
            break;
        }
        break;
      case NodeType.SERVICE:
        content.unshift(service);
        break;
      case NodeType.UNKNOWN:
        content.unshift(UNKNOWN);
        break;
      case NodeType.WORKLOAD:
        content.unshift(workload);
        break;
      default:
        content.unshift('error');
    }

    const contentText = content.join('<br/>');
    const contentClasses = hasIcon ? `${contentDefault} ${contentWithBadges}` : `${contentDefault}`;
    let appBoxStyle = '';
    if (isBox) {
      let badge = '';
      switch (isBox) {
        case BoxByType.APP:
          badge = PFBadges.App.badge;
          appBoxStyle += `font-size: ${NodeTextFontSize};`;
          break;
        case BoxByType.CLUSTER:
          badge = PFBadges.Cluster.badge;
          break;
        case BoxByType.NAMESPACE:
          badge = PFBadges.Namespace.badge;
          break;
        default:
          console.warn(`GraphSyles: Unexpected box [${isBox}] `);
      }
      const contentBadge = `<span class="pf-c-badge pf-m-unread ${contentBoxPfBadge}" style="${appBoxStyle}">${badge}</span>`;
      const contentSpan = `<span class="${contentClasses} ${contentBox}" style=" ${appBoxStyle}${contentStyle}">${contentBadge}${contentText}</span>`;
      return `<div class="${labelDefault} ${labelBox}" style="${labelStyle}">${icons}${contentSpan}</div>`;
    }

    let hosts: string[] = [];
    node.hasVS?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));
    node.isGateway?.ingressInfo?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));

    let htmlHosts = '';
    if (hosts.length !== 0) {
      let hostsToShow = hosts;
      if (hostsToShow.length > config.graph.maxHosts) {
        hostsToShow = hosts.slice(0, config.graph.maxHosts);
        hostsToShow.push(
          hosts.length - config.graph.maxHosts === 1
            ? '1 more host...'
            : `${hosts.length - config.graph.maxHosts} more hosts...`
        );
      }
      htmlHosts = `<div class='${hostsClass}'><div>${hosts.length} ${
        hosts.length === 1 ? 'host' : 'hosts'
      }</div><div>${hostsToShow.join('<br/>')}</div></div>`;
    }

    const contentSpan = `<div class="${contentClasses}" style="display: block; ${contentStyle}"><div>${contentText}</div><div></div>${htmlHosts}</div></div>`;
    return `<div class="${labelDefault}" style="${labelStyle}">${icons}${contentSpan}</div>`;
  }

  static htmlNodeLabels(cy: Cy.Core) {
    return [
      {
        query: 'node:visible',
        halign: 'center',
        valign: 'bottom',
        halignBox: 'center',
        valignBox: 'bottom',
        tpl: (data: any) => this.getNodeLabel(cy.$id(data.id))
      }
    ];
  }

  static styles(): Cy.Stylesheet[] {
    GraphStyles.setRuntimeColors();

    const getCyGlobalData = (ele: Cy.NodeSingular | Cy.EdgeSingular): CytoscapeGlobalScratchData => {
      return ele.cy().scratch(CytoscapeGlobalScratchNamespace);
    };

    const getEdgeColor = (ele: Cy.EdgeSingular): string => {
      const edgeData = decoratedEdgeData(ele);
      const cyGlobal = getCyGlobalData(ele);

      if (!edgeData.hasTraffic) {
        return EdgeColorDead;
      }
      if (edgeData.protocol === 'tcp') {
        return EdgeColorTCPWithTraffic;
      }
      if (edgeData.protocol === 'grpc' && !cyGlobal.trafficRates.includes(TrafficRate.GRPC_REQUEST)) {
        return EdgeColor;
      }

      const sourceNodeData = decoratedNodeData(ele.source());
      const destNodeData = decoratedNodeData(ele.target());
      const statusEdge = getEdgeHealth(edgeData, sourceNodeData, destNodeData);

      switch (statusEdge.status) {
        case FAILURE:
          return EdgeColorFailure;
        case DEGRADED:
          return EdgeColorDegraded;
        default:
          return EdgeColor;
      }
    };

    const getEdgeLabel = (ele: Cy.EdgeSingular, isVerbose?: boolean): string => {
      const cyGlobal = getCyGlobalData(ele);
      const edgeLabels = cyGlobal.edgeLabels;
      const edgeData = decoratedEdgeData(ele);
      const includeUnits = isVerbose || numLabels(edgeLabels) > 1;
      let labels = [] as string[];

      if (edgeLabels.includes(EdgeLabelMode.TRAFFIC_RATE)) {
        let rate = 0;
        let pErr = 0;
        if (edgeData.http > 0) {
          rate = edgeData.http;
          pErr = edgeData.httpPercentErr > 0 ? edgeData.httpPercentErr : 0;
        } else if (edgeData.grpc > 0) {
          rate = edgeData.grpc;
          pErr = edgeData.grpcPercentErr > 0 ? edgeData.grpcPercentErr : 0;
        } else if (edgeData.tcp > 0) {
          rate = edgeData.tcp;
        }

        if (rate > 0) {
          if (pErr > 0) {
            labels.push(`${toFixedRequestRate(rate, includeUnits)}\n${toFixedErrRate(pErr)}`);
          } else {
            switch (edgeData.protocol) {
              case Protocol.GRPC:
                if (cyGlobal.trafficRates.includes(TrafficRate.GRPC_REQUEST)) {
                  labels.push(toFixedRequestRate(rate, includeUnits));
                } else {
                  labels.push(toFixedRequestRate(rate, includeUnits, 'mps'));
                }
                break;
              case Protocol.TCP:
                labels.push(toFixedByteRate(rate, includeUnits));
                break;
              default:
                labels.push(toFixedRequestRate(rate, includeUnits));
                break;
            }
          }
        }
      }

      if (edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_GROUP)) {
        // todo: remove this logging once we figure out the strangeness going on with responseTime
        let logResponseTime = edgeData.responseTime;
        if (!isNaN(logResponseTime) && !Number.isInteger(logResponseTime)) {
          console.log(`Unexpected string responseTime=|${logResponseTime}|`);
        }
        // hack to fix responseTime is sometimes a string during runtime even though its type is number
        const responseTimeNumber = parseInt(String(edgeData.responseTime));
        const responseTime = responseTimeNumber > 0 ? responseTimeNumber : 0;
        if (responseTime && responseTime > 0) {
          labels.push(toFixedDuration(responseTime));
        }
      }

      if (edgeLabels.includes(EdgeLabelMode.THROUGHPUT_GROUP)) {
        let rate = edgeData.throughput;

        if (rate > 0) {
          labels.push(toFixedByteRate(rate, includeUnits));
        }
      }

      if (edgeLabels.includes(EdgeLabelMode.TRAFFIC_DISTRIBUTION)) {
        let pReq;
        if (edgeData.httpPercentReq > 0) {
          pReq = edgeData.httpPercentReq;
        } else if (edgeData.grpcPercentReq > 0) {
          pReq = edgeData.grpcPercentReq;
        }
        if (pReq > 0 && pReq < 100) {
          labels.push(toFixedPercent(pReq));
        }
      }

      let label = labels.join('\n');

      if (isVerbose) {
        const protocol = edgeData.protocol;
        label = protocol ? `${protocol}\n${label}` : label;
      }

      const mtlsPercentage = edgeData.isMTLS;
      let lockIcon = false;
      if (cyGlobal.showSecurity && edgeData.hasTraffic) {
        if (mtlsPercentage && mtlsPercentage > 0) {
          lockIcon = true;
          label = `${EdgeIconMTLS}\n${label}`;
        }
      }

      if (edgeData.hasTraffic && edgeData.responses) {
        const dest = decoratedNodeData(ele.target());
        if (dest.hasCB) {
          const responses = edgeData.responses;
          for (let code of _.keys(responses)) {
            // TODO: Not 100% sure we want "UH" code here ("no healthy upstream hosts") but based on timing I have
            // seen this code returned and not "UO". "UO" is returned only when the circuit breaker is caught open.
            // But if open CB is responsible for removing possible destinations the "UH" code seems preferred.
            if (responses[code]['UO'] || responses[code]['UH']) {
              label = lockIcon ? `${NodeIconCB} ${label}` : `${NodeIconCB}\n${label}`;
              break;
            }
          }
        }
      }

      return label;
    };

    const trimFixed = (fixed: string): string => {
      if (!fixed.includes('.')) {
        return fixed;
      }
      while (fixed.endsWith('0')) {
        fixed = fixed.slice(0, -1);
      }
      return fixed.endsWith('.') ? (fixed = fixed.slice(0, -1)) : fixed;
    };

    const toFixedRequestRate = (num: number, includeUnits: boolean, units?: string): string => {
      const rate = trimFixed(num.toFixed(2));
      return includeUnits ? `${rate} ${units || 'rps'}` : rate;
    };

    const toFixedErrRate = (num: number): string => {
      return `${trimFixed(num.toFixed(num < 1 ? 1 : 0))}% err`;
    };

    const toFixedByteRate = (num: number, includeUnits: boolean): string => {
      if (num < 1024.0) {
        const rate = num < 1.0 ? trimFixed(num.toFixed(2)) : num.toFixed(0);
        return includeUnits ? `${rate} bps` : rate;
      }
      const rate = trimFixed((num / 1024.0).toFixed(2));
      return includeUnits ? `${rate} kps` : rate;
    };

    const toFixedPercent = (num: number): string => {
      return `${trimFixed(num.toFixed(1))}%`;
    };

    const toFixedDuration = (num: number): string => {
      if (num < 1000) {
        return `${num.toFixed(0)}ms`;
      }
      return `${trimFixed((num / 1000.0).toFixed(2))}s`;
    };

    const getNodeBackgroundImage = (ele: Cy.NodeSingular): string => {
      const nodeData = decoratedNodeData(ele);
      const isInaccessible = nodeData.isInaccessible;
      const isServiceEntry = nodeData.isServiceEntry;
      const isBox = nodeData.isBox;
      if (isInaccessible && !isServiceEntry && !isBox) {
        return NodeImageKey;
      }
      const isOutside = nodeData.isOutside;
      if (isOutside && !isBox) {
        return NodeImageTopology;
      }
      return 'none';
    };

    const getNodeBackgroundPositionX = (ele: Cy.NodeSingular): string => {
      if (getNodeShape(ele) === 'round-tag') {
        return '0';
      }
      return '50%';
    };

    const getNodeBackgroundPositionY = (ele: Cy.NodeSingular): string => {
      if (getNodeShape(ele) === 'round-triangle') {
        return '6px';
      }
      return '50%';
    };

    const getNodeBorderColor = (ele: Cy.NodeSingular): string => {
      const isBox = ele.data(CyNode.isBox);
      if (isBox && isBox !== BoxByType.APP) {
        return NodeColorBorderBox;
      }

      const healthStatus = ele.data(CyNode.healthStatus);
      switch (healthStatus) {
        case DEGRADED.name:
          return NodeColorBorderDegraded;
        case FAILURE.name:
          return NodeColorBorderFailure;
        default:
          return NodeColorBorder;
      }
    };

    const getNodeShape = (ele: Cy.NodeSingular): Cy.Css.NodeShape => {
      const nodeData = decoratedNodeData(ele);
      const nodeType = nodeData.nodeType;
      switch (nodeType) {
        case NodeType.AGGREGATE:
          return 'round-pentagon';
        case NodeType.APP:
          return 'round-rectangle';
        case NodeType.BOX:
          return 'round-rectangle';
        case NodeType.SERVICE:
          return nodeData.isServiceEntry ? 'round-tag' : 'round-triangle';
        case NodeType.UNKNOWN:
          return 'ellipse';
        case NodeType.WORKLOAD:
          return 'ellipse';
        default:
          return 'ellipse';
      }
    };

    const nodeSelectedStyle = {
      'border-color': (ele: Cy.NodeSingular) => {
        switch (ele.data(CyNode.healthStatus)) {
          case DEGRADED.name:
            return NodeColorBorderDegraded;
          case FAILURE.name:
            return NodeColorBorderFailure;
          default:
            return NodeColorBorderSelected;
        }
      },
      'border-width': NodeBorderWidthSelected
    };

    return [
      // Node Defaults
      {
        selector: 'node',
        css: {
          'background-color': NodeColorFill,
          'background-image': (ele: Cy.NodeSingular) => {
            return getNodeBackgroundImage(ele);
          },
          'background-width': '80%',
          'background-height': '80%',
          'background-position-x': getNodeBackgroundPositionX,
          'background-position-y': getNodeBackgroundPositionY,
          'border-color': (ele: Cy.NodeSingular) => {
            return getNodeBorderColor(ele);
          },
          'border-style': (ele: Cy.NodeSingular) => {
            return decoratedNodeData(ele).isIdle ? 'dotted' : 'solid';
          },
          'border-width': NodeBorderWidth,
          ghost: 'yes',
          'ghost-offset-x': 1,
          'ghost-offset-y': 1,
          'ghost-opacity': 0.4,
          height: NodeHeight,
          shape: (ele: Cy.NodeSingular) => {
            return getNodeShape(ele);
          },
          width: NodeWidth,
          'z-index': 10
        }
      },
      // Node is a Cluster Box
      {
        selector: `node[isBox="${BoxByType.CLUSTER}"]`,
        css: {
          'background-color': NodeColorFillBoxCluster
        }
      },
      // Node is a Namespace Box
      {
        selector: `node[isBox="${BoxByType.NAMESPACE}"]`,
        css: {
          'background-color': NodeColorFillBoxNamespace
        }
      },
      // Node is an App Box
      {
        selector: `node[isBox="${BoxByType.APP}"]`,
        css: {
          'background-color': NodeColorFillBoxApp
        }
      },
      // Node is selected
      {
        selector: 'node:selected',
        style: nodeSelectedStyle
      },
      // Node is highlighted (see GraphHighlighter.ts)
      {
        selector: `node.${HighlightClass}`,
        style: {
          'font-size': NodeTextFontSizeHover
        }
      },
      // Node other than Box is highlighted (see GraphHighlighter.ts)
      {
        selector: `node.${HighlightClass}[^isBox]`,
        style: {
          'background-color': (ele: Cy.NodeSingular) => {
            switch (ele.data(CyNode.healthStatus)) {
              case DEGRADED.name:
                return NodeColorFillHoverDegraded;
              case FAILURE.name:
                return NodeColorFillHoverFailure;
              default:
                return NodeColorFillHover;
            }
          },
          'border-color': (ele: Cy.NodeSingular) => {
            switch (ele.data(CyNode.healthStatus)) {
              case DEGRADED.name:
                return NodeColorBorderDegraded;
              case FAILURE.name:
                return NodeColorBorderFailure;
              default:
                return NodeColorBorderHover;
            }
          }
        }
      },
      // Node is dimmed (see GraphHighlighter.ts)
      {
        selector: `node.${DimClass}`,
        style: {
          opacity: 0.6
        }
      },
      {
        selector: 'edge',
        css: {
          'curve-style': 'bezier',
          'font-family': EdgeTextFont,
          'font-size': EdgeTextFontSize,
          label: (ele: Cy.EdgeSingular) => {
            return getEdgeLabel(ele);
          },
          'line-color': (ele: Cy.EdgeSingular) => {
            return getEdgeColor(ele);
          },
          'line-style': 'solid',
          'target-arrow-shape': 'vee',
          'target-arrow-color': (ele: Cy.EdgeSingular) => {
            return getEdgeColor(ele);
          },
          'text-events': 'yes',
          'text-outline-color': EdgeTextOutlineColor,
          'text-outline-width': EdgeTextOutlineWidth,
          'text-wrap': 'wrap',
          width: EdgeWidth
        }
      },
      {
        selector: 'edge:selected',
        css: {
          width: EdgeWidthSelected,
          label: (ele: Cy.EdgeSingular) => getEdgeLabel(ele, true)
        }
      },
      {
        selector: 'edge[protocol="tcp"]',
        css: {
          'target-arrow-shape': 'triangle-cross',
          'line-style': 'solid'
        }
      },
      {
        selector: `edge.${HighlightClass}`,
        style: {
          'font-size': EdgeTextFontSizeHover
        }
      },
      {
        selector: `edge.${HoveredClass}`,
        style: {
          label: (ele: Cy.EdgeSingular) => {
            return getEdgeLabel(ele, true);
          }
        }
      },
      {
        selector: `edge.${DimClass}`,
        style: {
          opacity: 0.3
        }
      },
      {
        selector: '*.find[^isBox]',
        style: {
          'overlay-color': PFColorVals.Gold400,
          'overlay-padding': '7px',
          'overlay-opacity': 0.3
        }
      },
      {
        selector: '*.span[^isBox]',
        style: {
          'overlay-color': PFColorVals.Purple200,
          'overlay-padding': '7px',
          'overlay-opacity': 0.3
        }
      }
    ];
  }
}
