import { PfColors } from '../../../components/Pf/PfColors';

export class GraphStyles {
  static options() {
    return { wheelSensitivity: 0.1, autounselectify: false, autoungrabify: true };
  }

  static styles() {
    return [
      {
        selector: 'node',
        css: {
          color: PfColors.Black,
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
          'background-color': PfColors.Gold200,
          'border-color': PfColors.Black,
          'border-style': (ele: any) => {
            return ele.data('isUnused') ? 'dotted' : 'solid';
          },
          'border-width': '1px',
          'font-size': '10px',
          'overlay-padding': '6px',
          'text-halign': 'center',
          'text-outline-color': PfColors.Gold200,
          'text-outline-width': '2px',
          'text-valign': 'center',
          'text-wrap': 'wrap',
          'z-index': '10'
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': '3px',
          'border-color': PfColors.Blue
        }
      },
      {
        selector: 'node[isRoot]',
        style: {
          shape: 'diamond'
        }
      },
      {
        // version group boxes
        selector: '$node > node',
        css: {
          'text-valign': 'top',
          'text-halign': 'right',
          'text-margin-x': '2px',
          'text-margin-y': '8px',
          'text-rotation': '90deg',
          'background-color': PfColors.Gold100
        }
      },
      {
        selector: 'edge',
        css: {
          content: (ele: any) => {
            if (!ele.data('showEdgeLabels')) {
              return '';
            }
            const rate = ele.data('rate') ? parseFloat(ele.data('rate')) : 0;
            const pErr = ele.data('percentErr') ? parseFloat(ele.data('percentErr')) : 0;
            if (rate > 0) {
              return pErr > 0 ? rate.toFixed(2) + ', ' + pErr.toFixed(1) + '%' : rate.toFixed(2);
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
              return PfColors.Red;
            }
            if (pErr > 0.1) {
              return PfColors.Orange;
            }
            return PfColors.Green;
          },
          'line-style': (ele: any) => {
            return ele.data('isUnused') ? 'dotted' : 'solid';
          },
          'target-arrow-shape': 'vee',
          'text-margin-x': '6px',
          'text-rotation': 'autorotate',
          'target-arrow-color': PfColors.Black,
          width: 2
        }
      },
      {
        selector: 'edge:selected',
        css: {
          'line-color': PfColors.Blue,
          'target-arrow-color': PfColors.Blue,
          'source-arrow-color': PfColors.Blue
        }
      },
      // When you mouse over a node, all nodes other than the moused over node
      // and its direct incoming/outgoing edges/nodes are dimmed by these styles.
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
