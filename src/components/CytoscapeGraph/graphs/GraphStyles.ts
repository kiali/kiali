import { PfColors } from '../../../components/Pf/PfColors';
import { EdgeLabelMode } from '../../../types/GraphFilter';
import { FAILURE, DEGRADED, REQUESTS_THRESHOLDS } from '../../../types/Health';
import { GraphType, NodeType, CytoscapeGlobalScratchNamespace, CytoscapeGlobalScratchData } from '../../../types/Graph';
import { COMPOUND_PARENT_NODE_CLASS } from '../Layout/GroupCompoundLayout';
import { ICONS } from '../../../config';
import { EDGE_HTTP, EDGE_TCP } from '../../../utils/TrafficRate';

export const DimClass = 'mousedim';

// UX-specified colors, widths, etc
const EdgeColor = PfColors.Green400;
const EdgeColorDead = PfColors.Black500;
const EdgeColorDegraded = PfColors.Orange;
const EdgeColorFailure = PfColors.Red;
const EdgeIconLock = '\ue923'; // lock
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
const NodeIconCB = ICONS().ISTIO.CIRCUIT_BREAKER.ascii; // bolt
const NodeIconMS = ICONS().ISTIO.MISSING_SIDECAR.ascii; // exclamation
const NodeIconVS = ICONS().ISTIO.VIRTUALSERVICE.ascii; // code-branch
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

    const getHttpEdgeColor = (ele: any): string => {
      const http = ele.data(EDGE_HTTP.RATE) ? Number(ele.data(EDGE_HTTP.RATE)) : 0;
      if (http === 0 || ele.data('isUnused')) {
        return EdgeColorDead;
      }
      const pErr = ele.data('httpPercentErr') ? Number(ele.data('httpPercentErr')) : 0;
      if (pErr > REQUESTS_THRESHOLDS.failure) {
        return EdgeColorFailure;
      }
      if (pErr > REQUESTS_THRESHOLDS.degraded) {
        return EdgeColorDegraded;
      }
      return EdgeColor;
    };

    const getEdgeLabel = (ele: any): string => {
      const cyGlobal = getCyGlobalData(ele);
      const edgeLabelMode = cyGlobal.edgeLabelMode;
      let content = '';

      switch (edgeLabelMode) {
        case EdgeLabelMode.TRAFFIC_RATE_PER_SECOND: {
          if (ele.data(EDGE_HTTP.RATE)) {
            const http = Number(ele.data(EDGE_HTTP.RATE));
            if (http > 0) {
              const httpPercentErr = ele.data('httpPercentErr') ? Number(ele.data('httpPercentErr')) : 0;
              content = httpPercentErr > 0 ? http.toFixed(2) + ', ' + httpPercentErr.toFixed(1) + '%' : http.toFixed(2);
            }
          } else if (ele.data(EDGE_TCP.RATE)) {
            const tcp = Number(ele.data(EDGE_TCP.RATE));
            if (tcp > 0) {
              content = `${tcp.toFixed(2)}`;
            }
          }
          break;
        }
        case EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE: {
          const responseTime = ele.data('responseTime') ? Number(ele.data('responseTime')) : 0;
          if (responseTime > 0) {
            content = responseTime < 1000.0 ? responseTime.toFixed(0) + 'ms' : (responseTime / 1000.0).toFixed(2) + 's';
          }
          break;
        }
        case EdgeLabelMode.REQUESTS_PERCENT_OF_TOTAL: {
          const httpPercentReq = ele.data('httpPercentReq') ? Number(ele.data('httpPercentReq')) : 0;
          content = httpPercentReq > 0 ? httpPercentReq.toFixed(1) + '%' : '';
          break;
        }
        default:
          content = '';
      }

      if (cyGlobal.showSecurity && ele.data('isMTLS')) {
        content = EdgeIconLock + ' ' + content;
      }

      return content;
    };

    const getNodeBackgroundImage = (ele: any): string => {
      const isInaccessible = ele.data('isInaccessible');
      const isServiceEntry = ele.data('isServiceEntry');
      if (isInaccessible && !isServiceEntry) {
        return NodeImageKey;
      }
      const isOutside = ele.data('isOutside');
      const isGroup = ele.data('isGroup');
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
      const app = ele.data('app');
      const cyGlobal = getCyGlobalData(ele);
      const isServiceEntry = ele.data('isServiceEntry') !== undefined;
      const namespace = ele.data('namespace');
      const nodeType = ele.data('nodeType');
      const service = ele.data('service');
      const version = ele.data('version');
      const workload = ele.data('workload');
      const numNS = cyGlobal.activeNamespaces.length;
      const isMultiNamespace = numNS > 1 || (numNS === 1 && cyGlobal.activeNamespaces[0].name === 'all');
      let content = '';

      if (getCyGlobalData(ele).showNodeLabels) {
        if (ele.data('parent')) {
          switch (nodeType) {
            case NodeType.APP:
              if (version && version !== 'unknown') {
                content = version;
              } else {
                content = app;
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
          let contentArray: string[] = [];
          if ((isMultiNamespace || ele.data('isOutside')) && !(isServiceEntry || nodeType === NodeType.UNKNOWN)) {
            contentArray.push(namespace);
          }
          switch (nodeType) {
            case NodeType.APP:
              if (cyGlobal.graphType === GraphType.APP || ele.data('isGroup') || version === 'unknown') {
                contentArray.unshift(app);
              } else {
                contentArray.unshift(app);
                contentArray.push(version);
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
      if (cyGlobal.showMissingSidecars && ele.data('hasMissingSC')) {
        badges = NodeIconMS + badges;
      }
      if (cyGlobal.showCircuitBreakers && ele.data('hasCB')) {
        badges = NodeIconCB + badges;
      }
      if (cyGlobal.showVirtualServices && ele.data('hasVS')) {
        badges = NodeIconVS + badges;
      }
      return badges + content;
    };

    const getNodeShape = (ele: any): string => {
      const nodeType = ele.data('nodeType');
      switch (nodeType) {
        case NodeType.APP:
          return 'square';
        case NodeType.SERVICE:
          return ele.data('isServiceEntry') ? 'tag' : 'triangle';
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
      if (cyGlobal.showMissingSidecars && ele.data('hasMissingSC')) {
        return true;
      }
      if (cyGlobal.showCircuitBreakers && ele.data('hasCB')) {
        return true;
      }
      return cyGlobal.showVirtualServices && ele.data('hasVS');
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
            return ele.data('isUnused') ? 'dotted' : 'solid';
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
      {
        selector: 'node:selected',
        style: nodeSelectedStyle
      },
      {
        // version group
        selector: `$node > node, node.${COMPOUND_PARENT_NODE_CLASS}`,
        css: {
          'text-valign': 'top',
          'text-halign': 'right',
          'text-margin-x': '2px',
          'text-margin-y': '8px',
          'text-rotation': '90deg',
          'background-color': NodeColorFillBox
        }
      },
      // Uncomment and update if we decide to apply style overrides for a selected group (composite) node
      // {
      //  // version group selected
      //  selector: '$node:selected',
      //  css: {
      //    'background-color': PfColors.Blue50
      //  }
      // },
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
            return getHttpEdgeColor(ele);
          },
          'line-style': (ele: any) => {
            return ele.data('isUnused') ? 'dotted' : 'solid';
          },
          'target-arrow-shape': 'vee',
          'target-arrow-color': (ele: any) => {
            return getHttpEdgeColor(ele);
          },
          'text-outline-color': EdgeTextOutlineColor,
          'text-outline-width': EdgeTextOutlineWidth,
          width: EdgeWidth
        }
      },
      {
        selector: 'edge:selected',
        css: {
          width: EdgeWidthSelected
        }
      },
      {
        selector: 'edge[tcp]',
        css: {
          'target-arrow-shape': 'triangle-cross',
          'line-color': PfColors.Blue600,
          'target-arrow-color': PfColors.Blue600
        }
      },
      // When you mouse over a node, all nodes other than the moused over node
      // and its direct incoming/outgoing edges/nodes are dimmed by these styles.
      {
        selector: 'node.mousehighlight',
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
          },
          'font-size': NodeTextFontSizeHover
        }
      },
      {
        selector: 'edge.mousehighlight',
        style: {
          'font-size': EdgeTextFontSizeHover
        }
      },
      {
        selector: 'node.' + DimClass,
        style: {
          opacity: '0.6'
        }
      },
      {
        selector: 'edge.' + DimClass,
        style: {
          opacity: '0.3'
        }
      }
    ];
  }
}
