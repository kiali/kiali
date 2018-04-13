import Element from 'cytoscape';

const FLASH_BADGE: string = 'glyphicon glyphicon-flash';
const MAIL_BADGE: string = 'glyphicon glyphicon-envelope';

class GraphBadge {
  node: Element;
  badgeType: string;
  badgeColor: string;
  placement: string;

  constructor(node: Element, badgeType: string, badgeColor: string, placement: string) {
    this.node = node;
    this.badgeType = badgeType;
    this.badgeColor = badgeColor;
    this.placement = placement;
  }

  buildBadge() {
    const div = document.createElement('div');
    div.className = this.badgeType;
    div.style.color = this.badgeColor;
    div.style.zIndex = this.node.css('z-index');
    div.style.position = 'absolute';

    this.node
      .cy()
      .container()
      .children[0].appendChild(div);

    const setScale = () => {
      const zoom = this.node.cy().zoom();
      div.style.transform = div.style.transform + `scale(${zoom},${zoom})`;
    };

    const popper = this.node.popper({
      content: target => div,
      // we need to re-position. the default isn't right.
      renderedPosition: element => {
        const offset = element
          .cy()
          .container()
          .getBoundingClientRect();
        const position = this.node.renderedPosition();
        const zoom = this.node.cy().zoom();
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

    this.node.on('position', update);
    this.node.on('style', highlighter);
    this.node.cy().on('pan zoom resize', update);
    this.node.cy().on('destroy', destroy);
  }
}

export class CircuitBreakerBadge extends GraphBadge {
  constructor(node: Element) {
    super(node, FLASH_BADGE, '#8461f7', 'top'); // color is pf-purple-300
  }
}

export class MessageBadge extends GraphBadge {
  constructor(node: Element) {
    super(node, MAIL_BADGE, '#92d400', 'bottom'); // color is pf-light-green-400
  }
}
