import { PfColors } from '../../../components/Pf/PfColors';
import { EdgeLabelMode } from '../../../types/GraphFilter';
import { FAILURE, DEGRADED, REQUESTS_THRESHOLDS } from '../../../types/Health';
import { GraphType, NodeType, CytoscapeGlobalScratchNamespace, CytoscapeGlobalScratchData } from '../../../types/Graph';
import { icons } from '../../../config';

import NodeImageTopology from '../../../assets/img/node-background-topology.png';
import NodeImageKey from '../../../assets/img/node-background-key.png';
import { edgeData, nodeData } from '../CytoscapeGraphUtils';

export const DimClass = 'mousedim';

// UX-specified colors, widths, etc
const EdgeColor = PfColors.Green400;
const EdgeColorDead = PfColors.Black500;
const EdgeColorDegraded = PfColors.Orange;
const EdgeColorFailure = PfColors.Red;
const EdgeColorTCPWithTraffic = PfColors.Blue600;
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
      const data = edgeData(ele);
      if (data.http > 0) {
        rate = data.http;
        pErr = data.httpPercentErr > 0 ? data.httpPercentErr : 0;
      } else if (data.grpc > 0) {
        rate = data.grpc;
        pErr = data.grpcPercentErr > 0 ? data.grpcPercentErr : 0;
      } else if (data.tcp > 0) {
        rate = data.tcp;
      }

      if (rate === 0) {
        return EdgeColorDead;
      }
      if (data.protocol === 'tcp') {
        return EdgeColorTCPWithTraffic;
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
      const data = edgeData(ele);

      switch (edgeLabelMode) {
        case EdgeLabelMode.REQUESTS_PER_SECOND: {
          let rate = 0;
          let pErr = 0;
          if (data.http > 0) {
            rate = data.http;
            pErr = data.httpPercentErr > 0 ? data.httpPercentErr : 0;
          } else if (data.grpc > 0) {
            rate = data.grpc;
            pErr = data.grpcPercentErr > 0 ? data.grpcPercentErr : 0;
          } else if (data.tcp > 0) {
            rate = data.tcp;
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
          const responseTime = data.responseTime > 0 ? data.responseTime : 0;
          if (responseTime > 0) {
            content = responseTime < 1000.0 ? `${responseTime.toFixed(0)}ms` : `${(responseTime / 1000.0).toFixed(2)}s`;
          }
          break;
        }
        case EdgeLabelMode.REQUESTS_PERCENTAGE: {
          let pReq;
          if (data.httpPercentReq > 0) {
            pReq = data.httpPercentReq;
          } else if (data.grpcPercentReq > 0) {
            pReq = data.grpcPercentReq;
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
        const protocol = data.protocol;
        content = protocol ? `${protocol} ${content}` : content;
      }

      const mtlsPercentage = data.isMTLS;
      if (cyGlobal.showSecurity && mtlsPercentage && mtlsPercentage >= 0) {
        if (mtlsPercentage > 0 && !cyGlobal.mtlsEnabled) {
          content = `${EdgeIconMTLS} ${content}`;
        } else if (mtlsPercentage < 100 && cyGlobal.mtlsEnabled) {
          content = `${EdgeIconDisabledMTLS} ${content}`;
        }
      }

      return content;
    };

    const getNodeBackgroundImage = (ele: any): string => {
      const data = nodeData(ele);
      const isInaccessible = data.isInaccessible;
      const isServiceEntry = data.isServiceEntry;
      const isGroup = data.isGroup;
      if (isInaccessible && !isServiceEntry && !isGroup) {
        return NodeImageKey;
      }
      const isOutside = data.isOutside;
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
      const data = nodeData(ele);

      if (getCyGlobalData(ele).showNodeLabels) {
        const app = data.app || '';
        const isGroup = data.isGroup;
        const isGroupMember = data.parent;
        const isMultiNamespace = cyGlobal.activeNamespaces.length > 1;
        const isOutside = data.isOutside;
        const isServiceEntry = data.isServiceEntry !== undefined;
        const namespace = data.namespace;
        const nodeType = data.nodeType;
        const service = data.service || '';
        const version = data.version || '';
        const workload = data.workload || '';

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
      if (cyGlobal.showMissingSidecars && data.hasMissingSC) {
        badges = NodeIconMS + badges;
      }
      if (cyGlobal.showCircuitBreakers && data.hasCB) {
        badges = NodeIconCB + badges;
      }
      if (cyGlobal.showVirtualServices && data.hasVS) {
        badges = NodeIconVS + badges;
      }
      return badges + content;
    };

    const getNodeShape = (ele: any): string => {
      const data = nodeData(ele);
      const nodeType = data.nodeType;
      switch (nodeType) {
        case NodeType.APP:
          return 'square';
        case NodeType.SERVICE:
          return data.isServiceEntry ? 'tag' : 'triangle';
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
      const data = nodeData(ele);
      if (cyGlobal.showMissingSidecars && data.hasMissingSC) {
        return true;
      }
      if (cyGlobal.showCircuitBreakers && data.hasCB) {
        return true;
      }
      if (cyGlobal.showVirtualServices && data.hasVS) {
        return true;
      }
      return false;
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
            return nodeData(ele).isUnused ? 'dotted' : 'solid';
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
        selector: 'edge[protocol="tcp"]',
        css: {
          'target-arrow-shape': 'triangle-cross'
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
