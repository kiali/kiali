import { PfColors } from '../../../components/Pf/PfColors';
import { EdgeLabelMode } from '../../../types/GraphFilter';

export class GraphStyles {
  static options() {
    return { wheelSensitivity: 0.1, autounselectify: false, autoungrabify: true };
  }

  static styles() {
    return [
      {
        selector: 'node',
        css: {
          // color: PfColors.Black,
          content: (ele: any) => {
            const version = ele.data('version');
            if (!ele.data('showNodeLabels')) {
              return '';
            }
            if (ele.data('parent')) {
              return version;
            }
            const name = ele.data('service') || ele.data('id');
            const service = name.split('.')[0];
            return version && version !== 'unknown' ? service + '\n' + version : service;
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
        style: {
          'background-color': PfColors.Blue50,
          'border-color': PfColors.Blue200,
          'border-width': '2px'
        }
      },
      {
        selector: 'node[isRoot]',
        style: {
          shape: 'diamond'
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
            const edgeLabelMode = ele.data('edgeLabelMode');
            if (!edgeLabelMode) {
              return '';
            }
            if (edgeLabelMode === EdgeLabelMode.REQUESTS_PER_SECOND) {
              const rate = ele.data('rate') ? parseFloat(ele.data('rate')) : 0;
              const pErr = ele.data('percentErr') ? parseFloat(ele.data('percentErr')) : 0;
              if (rate > 0) {
                return pErr > 0 ? rate.toFixed(2) + ', ' + pErr.toFixed(1) + '%' : rate.toFixed(2);
              }
            } else if (edgeLabelMode === EdgeLabelMode.LATENCY_95TH_PERCENTILE) {
              const latency = ele.data('latency') ? parseFloat(ele.data('latency')) : 0;
              if (latency > 0) {
                return latency.toFixed(2) + 's';
              }
            }
            return '';
          },
          'curve-style': 'bezier',
          'font-size': '7px',
          'line-color': (ele: any) => {
            const rate = ele.data('rate') ? parseFloat(ele.data('rate')) : 0;
            if (rate === 0 || ele.data('isUnused')) {
              return PfColors.Black;
            }
            const pErr = ele.data('percentErr') ? parseFloat(ele.data('percentErr')) : 0;
            // todo: these thresholds should come from somewhere global
            if (pErr > 2.0) {
              return PfColors.Red100;
            }
            if (pErr > 0.1) {
              return PfColors.Orange400;
            }
            return PfColors.Green400;
          },
          'line-style': (ele: any) => {
            return ele.data('isUnused') ? 'dotted' : 'solid';
          },
          'target-arrow-shape': 'vee',
          'text-margin-x': '6px',
          'text-rotation': 'autorotate',
          'target-arrow-color': PfColors.Black,
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
        selector: 'node.mousedim',
        style: {
          opacity: '0.3'
        }
      },
      {
        selector: 'edge.mousedim',
        style: {
          opacity: '0.3'
        }
      }
    ];
  }
}
