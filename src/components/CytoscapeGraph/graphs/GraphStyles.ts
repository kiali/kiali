import { PfColors } from '../../../components/Pf/PfColors';
import { EdgeLabelMode } from '../../../types/GraphFilter';
import { FAILURE, DEGRADED, REQUESTS_THRESHOLDS } from '../../../types/Health';
import { GraphType, NodeType, CytoscapeGlobalScratchNamespace, CytoscapeGlobalScratchData } from '../../../types/Graph';
import { COMPOUND_PARENT_NODE_CLASS } from '../Layout/GroupCompoundLayout';

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
const NodeIconCB = '\uf0e7 '; // bolt
const NodeIconMS = '\uf12a '; // exclamation
const NodeIconVS = '\uf126 '; // code-branch
const NodeImageOut = require('../../../assets/img/node-out.png');
const NodeImageOutLocked = require('../../../assets/img/node-out-locked.png');
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
      const rate = ele.data('rate') ? Number(ele.data('rate')) : 0;
      if (rate === 0 || ele.data('isUnused')) {
        return EdgeColorDead;
      }
      const pErr = ele.data('percentErr') ? Number(ele.data('percentErr')) : 0;
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
          if (ele.data('rate')) {
            const rate = Number(ele.data('rate'));
            if (rate > 0) {
              const pErr = ele.data('percentErr') ? Number(ele.data('percentErr')) : 0;
              content = pErr > 0 ? rate.toFixed(2) + ', ' + pErr.toFixed(1) + '%' : rate.toFixed(2);
            }
          } else if (ele.data('tcpSentRate')) {
            const rate = Number(ele.data('tcpSentRate'));
            if (rate > 0) {
              content = `${rate.toFixed(2)}`;
            }
          }
          break;
        }
        case EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE: {
          const responseTime = ele.data('responseTime') ? Number(ele.data('responseTime')) : 0;
          if (responseTime > 0) {
            content = responseTime < 1.0 ? (responseTime * 1000).toFixed(0) + 'ms' : responseTime.toFixed(2) + 's';
          }
          break;
        }
        case EdgeLabelMode.REQUESTS_PERCENT_OF_TOTAL: {
          const percentRate = ele.data('percentRate') ? Number(ele.data('percentRate')) : 0;
          content = percentRate > 0 ? percentRate.toFixed(0) + '%' : '';
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
      const isOutside = ele.data('isOutside');
      const isGroup = ele.data('isGroup');
      const isInaccessible = ele.data('isInaccessible');

      if (isOutside && !isGroup) {
        if (isInaccessible) {
          return NodeImageOutLocked;
        } else {
          return NodeImageOut;
        }
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
      const nodeType = ele.data('nodeType');
      const namespace = ele.data('namespace');
      const app = ele.data('app');
      const version = ele.data('version');
      const workload = ele.data('workload');
      const service = ele.data('service');
      const cyGlobal = getCyGlobalData(ele);
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
          switch (nodeType) {
            case NodeType.APP:
              if (cyGlobal.graphType === GraphType.APP || ele.data('isGroup') || version === 'unknown') {
                content = app;
              } else {
                content = app + `\n${version}`;
              }
              break;
            case NodeType.SERVICE:
              content = service;
              break;
            case NodeType.UNKNOWN:
              content = 'unknown';
              break;
            case NodeType.WORKLOAD:
              content = workload;
              break;
            default:
              content = 'error';
          }

          if (ele.data('isOutside')) {
            content += `\n${namespace}`;
          }
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
          return 'triangle';
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
            return getEdgeColor(ele);
          },
          'line-style': (ele: any) => {
            return ele.data('isUnused') ? 'dotted' : 'solid';
          },
          'target-arrow-shape': 'vee',
          'target-arrow-color': (ele: any) => {
            return getEdgeColor(ele);
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
        selector: 'edge[tcpSentRate]',
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
