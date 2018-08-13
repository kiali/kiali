import { PfColors } from '../../../components/Pf/PfColors';
import { EdgeLabelMode } from '../../../types/GraphFilter';
import { config } from '../../../config';
import { FAILURE, DEGRADED } from '../../../types/Health';
import { GraphType, NodeType, CytoscapeGlobalScratchNamespace, CytoscapeGlobalScratchData } from '../../../types/Graph';

export const DimClass = 'mousedim';

export class GraphStyles {
  static options() {
    return { wheelSensitivity: 0.1, autounselectify: false, autoungrabify: true };
  }

  static styles() {
    const getCyGlobalData = (ele: any): CytoscapeGlobalScratchData => {
      return ele.cy().scratch(CytoscapeGlobalScratchNamespace);
    };

    const getEdgeColor = (ele: any): string => {
      const rate = ele.data('rate') ? parseFloat(ele.data('rate')) : 0;
      if (rate === 0 || ele.data('isUnused')) {
        return PfColors.Black;
      }
      const pErr = ele.data('percentErr') ? parseFloat(ele.data('percentErr')) : 0;
      if (pErr > config().threshold.percentErrorSevere) {
        return PfColors.Red100;
      }
      if (pErr > config().threshold.percentErrorWarn) {
        return PfColors.Orange400;
      }
      return PfColors.Green400;
    };

    const getTLSValue = (ele: any, tlsValue: string, nonTlsValue: string): string => {
      if (ele.data('isMTLS') && getCyGlobalData(ele).edgeLabelMode === EdgeLabelMode.MTLS_ENABLED) {
        return tlsValue;
      } else {
        return nonTlsValue;
      }
    };

    const nodeSelectedStyle = {
      'background-color': PfColors.Blue50,
      'border-color': PfColors.Blue200,
      'border-width': '2px'
    };

    return [
      {
        selector: 'node',
        css: {
          // color: PfColors.Black,
          content: (ele: any) => {
            const nodeType = ele.data('nodeType');
            const namespace = ele.data('namespace');
            const app = ele.data('app');
            const version = ele.data('version');
            const workload = ele.data('workload');
            const service = ele.data('service');

            if (!getCyGlobalData(ele).showNodeLabels) {
              return '';
            }

            if (ele.data('parent')) {
              if (nodeType !== NodeType.APP) {
                return 'error/unknown';
              }
              return version;
            }

            let content = '';
            switch (nodeType) {
              case NodeType.APP:
                if (getCyGlobalData(ele).graphType === GraphType.APP || ele.data('isGroup') || version === 'unknown') {
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

            return content;
          },
          'background-color': PfColors.Black200,
          'border-color': PfColors.Black400,
          'border-style': (ele: any) => {
            return ele.data('isUnused') ? 'dotted' : 'solid';
          },
          'border-width': '1px',
          'font-size': '8px',
          'overlay-padding': '6px',
          'text-halign': 'center',
          'text-valign': 'center',
          'text-wrap': 'wrap',
          'z-index': '10'
        }
      },
      {
        selector: 'node:selected',
        style: nodeSelectedStyle
      },
      {
        selector: 'node[isRoot]',
        style: {
          shape: 'diamond'
        }
      },
      {
        selector: 'node[isOutside]',
        style: {
          shape: 'pentagon'
        }
      },
      {
        selector: 'node[nodeType="service"]',
        style: {
          shape: 'octagon'
        }
      },
      {
        // version group
        selector: '$node > node',
        css: {
          'text-valign': 'top',
          'text-halign': 'right',
          'text-margin-x': '2px',
          'text-margin-y': '8px',
          'text-rotation': '90deg',
          'background-color': PfColors.Black100
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
          content: (ele: any) => {
            const edgeLabelMode = getCyGlobalData(ele).edgeLabelMode;
            switch (edgeLabelMode) {
              case EdgeLabelMode.REQUESTS_PER_SECOND: {
                const rate = ele.data('rate') ? parseFloat(ele.data('rate')) : 0;
                if (rate > 0) {
                  const pErr = ele.data('percentErr') ? parseFloat(ele.data('percentErr')) : 0;
                  return pErr > 0 ? rate.toFixed(2) + ', ' + pErr.toFixed(1) + '%' : rate.toFixed(2);
                }
                return '';
              }
              case EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE: {
                const responseTime = ele.data('responseTime') ? parseFloat(ele.data('responseTime')) : 0;
                if (responseTime > 0) {
                  return responseTime < 1.0 ? (responseTime * 1000).toFixed(0) + 'ms' : responseTime.toFixed(2) + 's';
                }
                return '';
              }
              case EdgeLabelMode.REQUESTS_PERCENT_OF_TOTAL: {
                const percentRate = ele.data('percentRate') ? parseFloat(ele.data('percentRate')) : 0;
                return percentRate > 0 ? percentRate.toFixed(0) + '%' : '';
              }
              case EdgeLabelMode.MTLS_ENABLED: {
                return ele.data('isMTLS') ? '\ue923' : '';
              }
              default:
                return '';
            }
          },
          'curve-style': 'bezier',
          'font-family': (ele: any) => {
            return getTLSValue(ele, 'PatternFlyIcons-webfont', 'inherit');
          },
          'text-rotation': (ele: any) => {
            return getTLSValue(ele, '0deg', 'autorotate');
          },
          'font-size': '7px',
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
          'text-margin-x': '6px',
          width: 1
        }
      },
      {
        selector: 'edge:selected',
        css: {
          'line-color': PfColors.Blue200,
          'source-arrow-color': PfColors.Blue200,
          'target-arrow-color': PfColors.Blue200,
          width: 2
        }
      },
      // When you mouse over a node, all nodes other than the moused over node
      // and its direct incoming/outgoing edges/nodes are dimmed by these styles.
      {
        selector: 'node.mousehighlight',
        style: {
          'background-color': PfColors.Blue50
        }
      },
      {
        selector: 'node.' + DimClass,
        style: {
          opacity: '0.6'
        }
      },
      {
        selector: 'node.' + DEGRADED.name,
        style: {
          'border-color': DEGRADED.color,
          'border-width': '3px'
        }
      },
      {
        selector: 'node.' + FAILURE.name,
        style: {
          'border-color': FAILURE.color,
          'border-width': '3px'
        }
      },
      {
        selector: 'node:selected.' + DEGRADED.name,
        style: nodeSelectedStyle
      },
      {
        selector: 'node:selected.' + FAILURE.name,
        style: nodeSelectedStyle
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
