import { PfColors } from '../../../components/Pf/PfColors';
import { EdgeLabelMode } from '../../../types/GraphFilter';
import { FAILURE, DEGRADED, REQUESTS_THRESHOLDS } from '../../../types/Health';
import { GraphType, NodeType, CytoscapeGlobalScratchNamespace, CytoscapeGlobalScratchData } from '../../../types/Graph';
import { icons } from '../../../config';
import { CyEdge, CyNode } from '../CytoscapeGraphUtils';

export const DimClass = 'mousedim';

// UX-specified colors, widths, etc
const EdgeColor = PfColors.Green400;
const EdgeColorDead = PfColors.Black500;
const EdgeColorDegraded = PfColors.Orange;
const EdgeColorFailure = PfColors.Red;
const EdgeIconMTLS = icons.istio.mtls.ascii; // lock
const EdgeIconDisabledMTLS = icons.istio.disabledMtls.ascii; // broken lock
const EdgeTextOutlineColor = PfColors.White;
const EdgeTextOutlineWidth = '1px';
const EdgeTextFont = 'Verdana,Arial,Helvetica,sans-serif,FontAwesome,PatternFlyIcons-webfont';
const EdgeTextFontSize = '6px';
const EdgeTextFontSizeHover = '10px';
const EdgeWidth = 1;
const EdgeWidthSelected = 3;
const NodeBorderWidth = '1px';
const NodeBorderWidthSelected = '3px';
const NodeColorBorder = PfColors.Black400;
const NodeColorBorderDegraded = PfColors.Orange;
const NodeColorBorderFailure = PfColors.Red;
const NodeColorBorderHover = PfColors.Blue300;
const NodeColorBorderSelected = PfColors.Blue300;
const NodeColorFill = PfColors.White;
const NodeColorFillBox = PfColors.Black100;
const NodeColorFillHover = PfColors.Blue50;
const NodeColorFillHoverDegraded = '#fdf2e5';
const NodeColorFillHoverFailure = '#ffe6e6';
const NodeHeight = '10px';
const NodeIconCB = icons.istio.circuitBreaker.ascii; // bolt
const NodeIconMS = icons.istio.missingSidecar.ascii; // exclamation
const NodeIconVS = icons.istio.virtualService.ascii; // code-branch
const NodeImageTopology = require('../../../assets/img/node-background-topology.png');
const NodeImageKey = require('../../../assets/img/node-background-key.png');
const NodeTextOutlineColor = PfColors.White;
const NodeTextOutlineWidth = '1px';
const NodeTextColor = PfColors.Black;
const NodeTextColorBadged = PfColors.Purple600;
const NodeTextFont = EdgeTextFont;
const NodeTextFontWeight = 'normal';
const NodeTextFontWeightBadged = 'normal';
const NodeTextFontSize = '8px';
const NodeTextFontSizeHover = '11px';
const NodeWidth = NodeHeight;

export class GraphStyles {
  static options() {
    return { wheelSensitivity: 0.1, autounselectify: false, autoungrabify: true };
  }

  static styles() {
    const getCyGlobalData = (ele: any): CytoscapeGlobalScratchData => {
      return ele.cy().scratch(CytoscapeGlobalScratchNamespace);
    };

    const getEdgeColor = (ele: any): string => {
      let rate = 0;
      let pErr = 0;
      if (ele.data(CyEdge.http) > 0) {
        rate = Number(ele.data(CyEdge.http));
        pErr = ele.data(CyEdge.httpPercentErr) > 0 ? Number(ele.data(CyEdge.httpPercentErr)) : 0;
      } else if (ele.data(CyEdge.grpc) > 0) {
        rate = Number(ele.data(CyEdge.grpc));
        pErr = ele.data(CyEdge.grpcPercentErr) > 0 ? Number(ele.data(CyEdge.grpcPercentErr)) : 0;
      }

      if (rate === 0) {
        return EdgeColorDead;
      }
      if (pErr > REQUESTS_THRESHOLDS.failure) {
        return EdgeColorFailure;
      }
      if (pErr > REQUESTS_THRESHOLDS.degraded) {
        return EdgeColorDegraded;
      }
      return EdgeColor;
    };

    const getEdgeLabel = (ele: any, includeProtocol?: boolean): string => {
      const cyGlobal = getCyGlobalData(ele);
      const edgeLabelMode = cyGlobal.edgeLabelMode;
      let content = '';

      switch (edgeLabelMode) {
        case EdgeLabelMode.REQUESTS_PER_SECOND: {
          let rate = 0;
          let pErr = 0;
          if (ele.data(CyEdge.http) > 0) {
            rate = Number(ele.data(CyEdge.http));
            pErr = ele.data(CyEdge.httpPercentErr) > 0 ? Number(ele.data(CyEdge.httpPercentErr)) : 0;
          } else if (ele.data(CyEdge.grpc) > 0) {
            rate = Number(ele.data(CyEdge.grpc));
            pErr = ele.data(CyEdge.grpcPercentErr) > 0 ? Number(ele.data(CyEdge.grpcPercentErr)) : 0;
          } else if (ele.data(CyEdge.tcp) > 0) {
            rate = Number(ele.data(CyEdge.tcp));
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
          const responseTime = ele.data(CyEdge.responseTime) > 0 ? Number(ele.data(CyEdge.responseTime)) : 0;
          if (responseTime > 0) {
            content = responseTime < 1000.0 ? `${responseTime.toFixed(0)}ms` : `${(responseTime / 1000.0).toFixed(2)}s`;
          }
          break;
        }
        case EdgeLabelMode.REQUESTS_PERCENTAGE: {
          let pReq;
          if (ele.data(CyEdge.httpPercentReq) > 0) {
            pReq = Number(ele.data(CyEdge.httpPercentReq));
          } else if (ele.data(CyEdge.grpcPercentReq) > 0) {
            pReq = Number(ele.data(CyEdge.grpcPercentReq));
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
        const protocol = ele.data(CyEdge.protocol);
        content = protocol ? `${protocol} ${content}` : content;
      }

      const mtlsPercentage = Number(ele.data(CyEdge.isMTLS));
      if (cyGlobal.showSecurity && mtlsPercentage >= 0) {
        if (mtlsPercentage > 0 && !cyGlobal.mtlsEnabled) {
          content = `${EdgeIconMTLS} ${content}`;
        } else if (mtlsPercentage < 100 && cyGlobal.mtlsEnabled) {
          content = `${EdgeIconDisabledMTLS} ${content}`;
        }
      }

      return content;
    };

    const getNodeBackgroundImage = (ele: any): string => {
      const isInaccessible = ele.data(CyNode.isInaccessible);
      const isServiceEntry = ele.data(CyNode.isServiceEntry);
      const isGroup = ele.data(CyNode.isGroup);
      if (isInaccessible && !isServiceEntry && !isGroup) {
        return NodeImageKey;
      }
      const isOutside = ele.data(CyNode.isOutside);
      if (isOutside && !isGroup) {
        return NodeImageTopology;
      }
      return 'none';
    };

    const getNodeBorderColor = (ele: any): string => {
      if (ele.hasClass(DEGRADED.name)) {
        return NodeColorBorderDegraded;
      }
      if (ele.hasClass(FAILURE.name)) {
        return NodeColorBorderFailure;
      }
      return NodeColorBorder;
    };

    const getNodeLabel = (ele: any): string => {
      let content = '';
      const cyGlobal = getCyGlobalData(ele);

      if (getCyGlobalData(ele).showNodeLabels) {
        const app = ele.data(CyNode.app);
        const isGroup = ele.data(CyNode.isGroup);
        const isGroupMember = ele.data('parent');
        const isMultiNamespace = cyGlobal.activeNamespaces.length > 1;
        const isOutside = ele.data(CyNode.isOutside);
        const isServiceEntry = ele.data(CyNode.isServiceEntry) !== undefined;
        const namespace = ele.data(CyNode.namespace);
        const nodeType = ele.data(CyNode.nodeType);
        const service = ele.data(CyNode.service);
        const version = ele.data(CyNode.version);
        const workload = ele.data(CyNode.workload);

        if (isGroupMember) {
          switch (nodeType) {
            case NodeType.APP:
              if (cyGlobal.graphType === GraphType.APP) {
                content = app;
              } else if (version && version !== 'unknown') {
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
          if ((isMultiNamespace || isOutside) && !(isServiceEntry || nodeType === NodeType.UNKNOWN)) {
            contentArray.push('(' + namespace + ')');
          }
          switch (nodeType) {
            case NodeType.APP:
              if (cyGlobal.graphType === GraphType.APP || isGroup || version === 'unknown') {
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
              contentArray.unshift('unknown');
              break;
            case NodeType.WORKLOAD:
              contentArray.unshift(workload);
              break;
            default:
              contentArray.unshift('error');
          }
          content = contentArray.join('\n');
        }
      }

      let badges = '';
      if (cyGlobal.showMissingSidecars && ele.data(CyNode.hasMissingSC)) {
        badges = NodeIconMS + badges;
      }
      if (cyGlobal.showCircuitBreakers && ele.data(CyNode.hasCB)) {
        badges = NodeIconCB + badges;
      }
      if (cyGlobal.showVirtualServices && ele.data(CyNode.hasVS)) {
        badges = NodeIconVS + badges;
      }
      return badges + content;
    };

    const getNodeShape = (ele: any): string => {
      const nodeType = ele.data(CyNode.nodeType);
      switch (nodeType) {
        case NodeType.APP:
          return 'square';
        case NodeType.SERVICE:
          return ele.data(CyNode.isServiceEntry) ? 'tag' : 'triangle';
        case NodeType.UNKNOWN:
          return 'diamond';
        case NodeType.WORKLOAD:
          return 'ellipse';
        default:
          return 'ellipse';
      }
    };

    const isNodeBadged = (ele: any): boolean => {
      const cyGlobal = getCyGlobalData(ele);
      if (cyGlobal.showMissingSidecars && ele.data(CyNode.hasMissingSC)) {
        return true;
      }
      if (cyGlobal.showCircuitBreakers && ele.data(CyNode.hasCB)) {
        return true;
      }
      return cyGlobal.showVirtualServices && ele.data(CyNode.hasVS);
    };

    const nodeSelectedStyle = {
      'border-color': (ele: any) => {
        if (ele.hasClass(DEGRADED.name)) {
          return NodeColorBorderDegraded;
        }
        if (ele.hasClass(FAILURE.name)) {
          return NodeColorBorderFailure;
        }
        return NodeColorBorderSelected;
      },
      'border-width': NodeBorderWidthSelected
    };

    return [
      // Node Defaults
      {
        selector: 'node',
        css: {
          'background-color': NodeColorFill,
          'background-image': (ele: any) => {
            return getNodeBackgroundImage(ele);
          },
          'background-fit': 'contain',
          'border-color': (ele: any) => {
            return getNodeBorderColor(ele);
          },
          'border-style': (ele: any) => {
            return ele.data(CyNode.isUnused) ? 'dotted' : 'solid';
          },
          'border-width': NodeBorderWidth,
          color: (ele: any) => {
            return isNodeBadged(ele) ? NodeTextColorBadged : NodeTextColor;
          },
          'font-family': NodeTextFont,
          'font-size': NodeTextFontSize,
          'font-weight': (ele: any) => {
            return isNodeBadged(ele) ? NodeTextFontWeightBadged : NodeTextFontWeight;
          },
          height: NodeHeight,
          label: (ele: any) => {
            return getNodeLabel(ele);
          },
          shape: (ele: any) => {
            return getNodeShape(ele);
          },
          'text-events': 'yes',
          'text-outline-color': NodeTextOutlineColor,
          'text-outline-width': NodeTextOutlineWidth,
          'text-halign': 'center',
          'text-margin-y': '-1px',
          'text-valign': 'top',
          'text-wrap': 'wrap',
          width: NodeWidth,
          'z-index': '10'
        }
      },
      // Node is an App Box
      {
        selector: `node[?isGroup]`,
        css: {
          'background-color': NodeColorFillBox,
          'text-margin-y': '4px',
          'text-valign': 'bottom'
        }
      },
      // Node is selected
      {
        selector: 'node:selected',
        style: nodeSelectedStyle
      },
      // Node is highlighted (see GraphHighlighter.ts)
      {
        selector: 'node.mousehighlight',
        style: {
          'font-size': NodeTextFontSizeHover
        }
      },
      // Node other than App Box is highlighted (see GraphHighlighter.ts)
      {
        selector: 'node.mousehighlight[^isGroup]',
        style: {
          'background-color': (ele: any) => {
            if (ele.hasClass(DEGRADED.name)) {
              return NodeColorFillHoverDegraded;
            }
            if (ele.hasClass(FAILURE.name)) {
              return NodeColorFillHoverFailure;
            }
            return NodeColorFillHover;
          },
          'border-color': (ele: any) => {
            if (ele.hasClass(DEGRADED.name)) {
              return NodeColorBorderDegraded;
            }
            if (ele.hasClass(FAILURE.name)) {
              return NodeColorBorderFailure;
            }
            return NodeColorBorderHover;
          }
        }
      },
      // Node is dimmed (see GraphHighlighter.ts)
      {
        selector: `node.${DimClass}`,
        style: {
          opacity: '0.6'
        }
      },
      {
        selector: 'edge',
        css: {
          'curve-style': 'bezier',
          'font-family': EdgeTextFont,
          'font-size': EdgeTextFontSize,
          label: (ele: any) => {
            return getEdgeLabel(ele);
          },
          'line-color': (ele: any) => {
            return getEdgeColor(ele);
          },
          'line-style': 'solid',
          'target-arrow-shape': 'vee',
          'target-arrow-color': (ele: any) => {
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
          label: (ele: any) => getEdgeLabel(ele, true)
        }
      },
      {
        selector: 'edge[tcp > 0]',
        css: {
          'target-arrow-shape': 'triangle-cross',
          'line-color': PfColors.Blue600,
          'target-arrow-color': PfColors.Blue600
        }
      },
      {
        selector: 'edge.mousehighlight',
        style: {
          'font-size': EdgeTextFontSizeHover
        }
      },
      {
        selector: 'edge.mousehover',
        style: {
          label: (ele: any) => {
            return getEdgeLabel(ele, true);
          }
        }
      },
      {
        selector: `edge.${DimClass}`,
        style: {
          opacity: '0.3'
        }
      },
      {
        selector: '*.find[^isGroup]',
        style: {
          'overlay-color': PfColors.Gold400,
          'overlay-padding': '8px',
          'overlay-opacity': '0.5'
        }
      }
    ];
  }
}
