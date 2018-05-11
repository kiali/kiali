import Element from 'cytoscape';
import { PfColors } from '../../../components/Pf/PfColors';

const FLASH_BADGE: string = 'fa fa-bolt';
const ROUTE_BADGE: string = 'fa fa-code-fork';
const SIDECAR_BADGE: string = 'pf pficon-blueprint';

// Each node that has a badge will have custom data associated with it.
// Each entry in the custom data is keyed on the badge type; an entry is itself
// a map with the references to the parent div and the popper itself (used so
// we can destroy them later if we need to).
// This supports being able to show any combination of multiple badges.
const CUSTOM_DATA_NAMESPACE = '_kiali_badges';

class GraphBadge {
  badgeType: string;
  badgeColor: string;
  placement: string;

  constructor(badgeType: string, badgeColor: string, placement: string) {
    this.badgeType = badgeType;
    this.badgeColor = badgeColor;
    this.placement = placement;
  }

  buildBadge(node: Element) {
    let badgesMap: any = node.scratch(CUSTOM_DATA_NAMESPACE);
    if (!badgesMap) {
      badgesMap = node.scratch(CUSTOM_DATA_NAMESPACE, {});
    }
    if (badgesMap[this.badgeType]) {
      return; // the node already has this badge
    }

    const div = document.createElement('div');
    div.className = this.badgeType;
    div.style.color = this.badgeColor;
    div.style.zIndex = node.css('z-index');
    div.style.position = 'absolute';

    node
      .cy()
      .container()
      .children[0].appendChild(div);

    const setScale = () => {
      const zoom = node.cy().zoom();
      div.style.fontSize = `${zoom}em`;
    };

    const popper = node.popper({
      content: target => div,
      // we need to re-position. the default isn't right.
      renderedPosition: element => {
        const offset = element
          .cy()
          .container()
          .getBoundingClientRect();
        const position = node.renderedPosition();
        const zoom = node.cy().zoom();
        return { x: position.x - offset.left + 4 * zoom, y: position.y - offset.top - 15 * zoom };
      },
      popper: {
        positionFixed: false,
        placement: this.placement,
        onCreate: setScale,
        onUpdate: setScale,
        modifiers: {
          inner: { enabled: true },
          preventOverflow: {
            enabled: true,
            padding: 0
          },
          flip: {
            enabled: false
          }
        }
      }
    });

    // add some custom data to the cy node data map indicating it has the badge
    badgesMap[this.badgeType] = { popper: popper, div: div };
    node.scratch(CUSTOM_DATA_NAMESPACE, badgesMap);

    let update = event => {
      popper.scheduleUpdate();
    };

    let destroy = event => {
      popper.destroy();
    };

    let highlighter = event => {
      // 'mousedim' is the class used by GraphHighlighter.
      // The opacity values are from GraphStyles.
      div.style.opacity = event.target.hasClass('mousedim') ? '0.3' : '1.0';
    };

    node.on('position', update);
    node.on('style', highlighter);
    node.cy().on('pan zoom resize', update);
    node.cy().on('destroy', destroy);
  }

  destroyBadge(node: Element) {
    let badgesMap: any = node.scratch(CUSTOM_DATA_NAMESPACE) || {};
    if (badgesMap[this.badgeType]) {
      // if the node has the badge...
      badgesMap[this.badgeType].popper.destroy();
      let div = badgesMap[this.badgeType].div;
      while (div.firstChild) {
        div.removeChild(div.firstChild);
      }
      div.remove();
      delete badgesMap[this.badgeType];
    }
  }
}

export class CircuitBreakerBadge extends GraphBadge {
  constructor() {
    super(FLASH_BADGE, PfColors.Purple300, 'top-start');
  }
}

export class RouteRuleBadge extends GraphBadge {
  constructor() {
    super(ROUTE_BADGE, PfColors.Purple300, 'top');
  }
}

export class MissingSidecarsBadge extends GraphBadge {
  constructor() {
    super(SIDECAR_BADGE, PfColors.Red100, 'bottom');
  }
}
