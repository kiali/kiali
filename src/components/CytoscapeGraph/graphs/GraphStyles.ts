import { style } from 'typestyle';
import {
  PfColors,
  withAlpha,
  getPFAlertColorVals,
  PFColorVal,
  PFAlertColorVals
} from '../../../components/Pf/PfColors';
import { FAILURE, DEGRADED } from '../../../types/Health';
import {
  EdgeLabelMode,
  GraphType,
  NodeType,
  CytoscapeGlobalScratchNamespace,
  CytoscapeGlobalScratchData,
  UNKNOWN
} from '../../../types/Graph';
import { icons } from '../../../config';
import NodeImageTopology from '../../../assets/img/node-background-topology.png';
import NodeImageKey from '../../../assets/img/node-background-key.png';
import { decoratedEdgeData, decoratedNodeData, CyNode } from '../CytoscapeGraphUtils';
import _ from 'lodash';
import * as Cy from 'cytoscape';

import { getEdgeHealth } from '../../../types/ErrorRate';

export const DimClass = 'mousedim';
export const HighlightClass = 'mousehighlight';
export const HoveredClass = 'mousehover';

let EdgeColor: PFColorVal;
const EdgeColorDead = PfColors.Black500;
let EdgeColorDegraded: PFColorVal;
let EdgeColorFailure: PFColorVal;
const EdgeColorTCPWithTraffic = PfColors.Blue600;
const EdgeIconMTLS = icons.istio.mtls.ascii; // lock
const EdgeIconDisabledMTLS = icons.istio.disabledMtls.ascii; // broken lock
const EdgeTextOutlineColor = PfColors.White;
const EdgeTextOutlineWidth = '1px';
const EdgeTextFont = 'Verdana,Arial,Helvetica,sans-serif,pficon';
const EdgeTextFontSize = '6px';
const EdgeTextFontSizeHover = '10px';
const EdgeWidth = 2;
const EdgeWidthSelected = 4;
const NodeBorderWidth = '1px';
const NodeBorderWidthSelected = '3px';
const NodeColorBorder = PfColors.Black400;
let NodeColorBorderDegraded: string;
let NodeColorBorderFailure: string;
const NodeColorBorderHover = PfColors.Blue300;
const NodeColorBorderSelected = PfColors.Blue300;
const NodeColorFill = PfColors.White;
const NodeColorFillBox = PfColors.White;
const NodeColorFillHover = PfColors.Blue50;
const NodeColorFillHoverDegraded = '#fdf2e5';
const NodeColorFillHoverFailure = '#ffe6e6';
const NodeHeight = '25px';
const NodeIconCB = icons.istio.circuitBreaker.className; // bolt
const NodeIconMS = icons.istio.missingSidecar.className; // exclamation
const NodeIconVS = icons.istio.virtualService.className; // code-branch
const NodeTextColor = PfColors.Black;
const NodeTextBackgroundColor = PfColors.White;
const NodeVersionParentTextColor = PfColors.White;
const NodeVersionParentBackgroundColor = PfColors.Black800;
const NodeBadgeBackgroundColor = PfColors.Purple400;
const NodeBadgeColor = PfColors.White;
const NodeBadgeFontSize = '12px';
const NodeTextFont = EdgeTextFont;
const NodeTextFontSize = '8px';
const NodeTextFontSizeHover = '11px';
const NodeWidth = NodeHeight;

const labelStyleDefault = style({
  borderRadius: '3px',
  boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.2), 0 2px 8px 0 rgba(0, 0, 0, 0.19)',
  display: 'flex',
  fontFamily: NodeTextFont,
  fontSize: '0',
  fontWeight: 'normal',
  marginTop: '4px',
  lineHeight: '11px',
  textAlign: 'center'
});

const contentStyleDefault = style({
  alignItems: 'center',
  backgroundColor: withAlpha(NodeTextBackgroundColor, 'a'),
  color: NodeTextColor,
  display: 'flex',
  fontSize: NodeTextFontSize,
  padding: '3px 5px',
  borderRadius: '3px',
  borderWidth: '1px'
});

const contentStyleWithBadges = style({
  borderBottomLeftRadius: 'unset',
  borderColor: NodeBadgeBackgroundColor,
  borderStyle: 'solid',
  borderTopLeftRadius: 'unset',
  borderLeft: '0'
});

const badgesDefaultStyle = style({
  alignItems: 'center',
  backgroundColor: NodeBadgeBackgroundColor,
  borderTopLeftRadius: '3px',
  borderBottomLeftRadius: '3px',
  color: NodeBadgeColor,
  display: 'flex',
  fontSize: NodeBadgeFontSize,
  padding: '3px 3px'
});

const badgeStyle = style({
  marginLeft: '1px'
});

export class GraphStyles {
  static colorsDefined: boolean;

  static defineColors = () => {
    if (GraphStyles.colorsDefined) {
      return;
    }
    const colorVals: PFAlertColorVals = getPFAlertColorVals();
    EdgeColor = colorVals.Success;
    EdgeColorDegraded = colorVals.Warning;
    EdgeColorFailure = colorVals.Danger;
    NodeColorBorderDegraded = colorVals.Warning;
    NodeColorBorderFailure = colorVals.Danger;
  };

  static options() {
    return { wheelSensitivity: 0.1, autounselectify: false, autoungrabify: true };
  }

  static htmlLabelForNode(ele: Cy.NodeSingular) {
    const getCyGlobalData = (ele: Cy.NodeSingular): CytoscapeGlobalScratchData => {
      return ele.cy().scratch(CytoscapeGlobalScratchNamespace);
    };

    let content = '';
    const cyGlobal = getCyGlobalData(ele);
    const data = decoratedNodeData(ele);
    let labelRawStyle = '';

    const isGroup = data.isGroup;

    if (ele.hasClass(HighlightClass)) {
      labelRawStyle += 'font-size: ' + NodeTextFontSizeHover + ';';
    }

    if (ele.hasClass(DimClass)) {
      labelRawStyle += 'opacity: 0.6;';
    }

    if (isGroup) {
      labelRawStyle += 'margin-top: 13px;';
    }

    let badges = '';
    if (cyGlobal.showMissingSidecars && data.hasMissingSC) {
      badges = `<span class="${NodeIconMS} ${badgeStyle}"></span> ${badges}`;
    }
    if (cyGlobal.showCircuitBreakers && data.hasCB) {
      badges = `<span class="${NodeIconCB} ${badgeStyle}"></span> ${badges}`;
    }
    if (cyGlobal.showVirtualServices && data.hasVS) {
      badges = `<span class="${NodeIconVS} ${badgeStyle}"></span> ${badges}`;
    }

    if (badges.length > 0) {
      badges = `<div class=${badgesDefaultStyle}>${badges}</div>`;
    }

    const hasBadge = badges.length > 0;

    if (getCyGlobalData(ele).showNodeLabels) {
      const app = data.app || '';
      const isGroupMember = data.parent;
      const isMultiNamespace = cyGlobal.activeNamespaces.length > 1;
      const isOutside = data.isOutside;
      const namespace = data.namespace;
      const nodeType = data.nodeType;
      const service = data.service || '';
      const version = data.version || '';
      const workload = data.workload || '';

      let contentRawStyle = '';

      if (isGroup) {
        contentRawStyle += `background-color: ${NodeVersionParentBackgroundColor};`;
        contentRawStyle += `color: ${NodeVersionParentTextColor};`;
      }
      if (ele.hasClass(HighlightClass)) {
        contentRawStyle += 'font-size: ' + NodeTextFontSizeHover + ';';
      }

      if (isGroupMember) {
        switch (nodeType) {
          case NodeType.AGGREGATE:
            content = data.aggregateValue!;
            break;
          case NodeType.APP:
            if (cyGlobal.graphType === GraphType.APP) {
              content = app;
            } else if (version && version !== UNKNOWN) {
              content = version;
            } else {
              content = workload ? `${workload}` : `${app}`;
            }
            break;
          case NodeType.SERVICE:
            content = service;
            break;
          case NodeType.WORKLOAD:
            content = workload;
            break;
          default:
            content = '';
        }
      } else {
        const contentArray: string[] = [];
        if ((isMultiNamespace || isOutside) && nodeType !== NodeType.UNKNOWN) {
          contentArray.push('(' + namespace + ')');
        }
        switch (nodeType) {
          case NodeType.AGGREGATE:
            contentArray.unshift(data.aggregateValue!);
            break;
          case NodeType.APP:
            if (cyGlobal.graphType === GraphType.APP || isGroup || version === UNKNOWN) {
              contentArray.unshift(app);
            } else {
              contentArray.unshift(version);
              contentArray.unshift(app);
            }
            break;
          case NodeType.SERVICE:
            contentArray.unshift(service);
            break;
          case NodeType.UNKNOWN:
            contentArray.unshift(UNKNOWN);
            break;
          case NodeType.WORKLOAD:
            contentArray.unshift(workload);
            break;
          default:
            contentArray.unshift('error');
        }
        content = contentArray.join('<br/>');
      }
      content = `<div class="${contentStyleDefault} ${
        hasBadge ? contentStyleWithBadges : ''
      }" style="${contentRawStyle}">${content}</div>`;
    }

    return `<div class="${labelStyleDefault}" style="${labelRawStyle}">${badges}${content}</div>`;
  }

  static htmlNodeLabels(cy: Cy.Core) {
    return [
      {
        query: 'node:visible',
        halign: 'center',
        valign: 'bottom',
        halignBox: 'center',
        valignBox: 'bottom',
        tpl: (data: any) => this.htmlLabelForNode(cy.$id(data.id))
      }
    ];
  }

  static styles(): Cy.Stylesheet[] {
    GraphStyles.defineColors();

    const getCyGlobalData = (ele: Cy.NodeSingular | Cy.EdgeSingular): CytoscapeGlobalScratchData => {
      return ele.cy().scratch(CytoscapeGlobalScratchNamespace);
    };

    const getEdgeColor = (ele: Cy.EdgeSingular): string => {
      const edgeData = decoratedEdgeData(ele);

      if (!edgeData.hasTraffic) {
        return EdgeColorDead;
      }
      if (edgeData.protocol === 'tcp') {
        return EdgeColorTCPWithTraffic;
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

    const getEdgeLabel = (ele: Cy.EdgeSingular, includeProtocol?: boolean): string => {
      const cyGlobal = getCyGlobalData(ele);
      const edgeLabelMode = cyGlobal.edgeLabelMode;
      let content = '';
      const edgeData = decoratedEdgeData(ele);

      switch (edgeLabelMode) {
        case EdgeLabelMode.REQUEST_RATE: {
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
              let sErr = pErr.toFixed(1);
              sErr = `${sErr.endsWith('.0') ? pErr.toFixed(0) : sErr}`;
              content = `${rate.toFixed(2)}\n${sErr}%`;
            } else {
              content = rate.toFixed(2);
            }
          }
          break;
        }
        case EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE: {
          // todo: remove this logging once we figure out the strangeness going on with responseTime
          let logResponseTime = edgeData.responseTime;
          if (!isNaN(logResponseTime) && !Number.isInteger(logResponseTime)) {
            console.log(`Unexpected string responseTime=|${logResponseTime}|`);
          }
          // hack to fix responseTime is sometimes a string during runtime even though its type is number
          const responseTimeNumber = parseInt(String(edgeData.responseTime));
          const responseTime = responseTimeNumber > 0 ? responseTimeNumber : 0;
          if (responseTime && responseTime > 0) {
            content = responseTime < 1000.0 ? `${responseTime.toFixed(0)}ms` : `${(responseTime / 1000.0).toFixed(2)}s`;
          }
          break;
        }
        case EdgeLabelMode.REQUEST_DISTRIBUTION: {
          let pReq;
          if (edgeData.httpPercentReq > 0) {
            pReq = edgeData.httpPercentReq;
          } else if (edgeData.grpcPercentReq > 0) {
            pReq = edgeData.grpcPercentReq;
          }
          if (pReq > 0) {
            const sReq = pReq.toFixed(1);
            content = `${sReq.endsWith('.0') ? pReq.toFixed(0) : sReq}%`;
          }
          break;
        }
        default:
          content = '';
      }

      if (includeProtocol) {
        const protocol = edgeData.protocol;
        content = protocol ? `${protocol} ${content}` : content;
      }

      const mtlsPercentage = edgeData.isMTLS;
      if (cyGlobal.showSecurity && edgeData.hasTraffic) {
        if (cyGlobal.mtlsEnabled) {
          if (!mtlsPercentage || mtlsPercentage < 100) {
            content = `${EdgeIconDisabledMTLS} ${content}`;
          }
        } else {
          if (mtlsPercentage && mtlsPercentage > 0) {
            content = `${EdgeIconMTLS} ${content}`;
          }
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
              content = `${NodeIconCB} ${content}`;
              break;
            }
          }
        }
      }

      return content;
    };

    const getNodeBackgroundImage = (ele: Cy.NodeSingular): string => {
      const nodeData = decoratedNodeData(ele);
      const isInaccessible = nodeData.isInaccessible;
      const isServiceEntry = nodeData.isServiceEntry;
      const isGroup = nodeData.isGroup;
      if (isInaccessible && !isServiceEntry && !isGroup) {
        return NodeImageKey;
      }
      const isOutside = nodeData.isOutside;
      if (isOutside && !isGroup) {
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
      switch (ele.data(CyNode.healthStatus)) {
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
            return decoratedNodeData(ele).isUnused ? 'dotted' : 'solid';
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
      // Node is an App Box
      {
        selector: `node[?isGroup]`,
        css: {
          'background-color': NodeColorFillBox
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
      // Node other than App Box is highlighted (see GraphHighlighter.ts)
      {
        selector: `node.${HighlightClass}[^isGroup]`,
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
        selector: '*.find[^isGroup]',
        style: {
          'overlay-color': PfColors.Gold400,
          'overlay-padding': '7px',
          'overlay-opacity': 0.3
        }
      },
      {
        selector: '*.span[^isGroup]',
        style: {
          'overlay-color': PfColors.Purple200,
          'overlay-padding': '7px',
          'overlay-opacity': 0.3
        }
      }
    ];
  }
}
