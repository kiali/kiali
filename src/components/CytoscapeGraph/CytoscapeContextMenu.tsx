import * as React from 'react';
import * as ReactDOM from 'react-dom';
import tippy, { Instance } from 'tippy.js';
import { DecoratedGraphEdgeData, DecoratedGraphNodeData } from '../../types/Graph';

type Props = {
  groupContextMenuContent?: ContextMenuNodeComponent;
  nodeContextMenuContent?: ContextMenuNodeComponent;
  edgeContextMenuContent?: ContextMenuEdgeComponent;
};

type ContextMenuContainer = HTMLDivElement & {
  _contextMenu: any;
};

type TippyInstance = Instance;

type ContextMenuProps = {
  element: any;
  contextMenu: TippyInstance;
};

export type ContextMenuNodeProps = DecoratedGraphNodeData & ContextMenuProps;
export type ContextMenuEdgeProps = DecoratedGraphEdgeData & ContextMenuProps;

export type ContextMenuNodeComponent = React.ComponentType<ContextMenuNodeProps>;
export type ContextMenuEdgeComponent = React.ComponentType<ContextMenuEdgeProps>;

// Keep the browser right-click menu from popping up since have our own context menu
window.oncontextmenu = (event: MouseEvent) => {
  const isChildrenOfTippy = (target: HTMLElement | null) => {
    if (target === null || target === document.body) {
      return false;
    } else if (target.className.startsWith('tippy')) {
      return true;
    }
    return isChildrenOfTippy(target.parentElement);
  };
  // Ironically, the tippy-arrow and sometimes the tippy-tooltip itself (or their contents) are the one that triggers the context menu.
  return !isChildrenOfTippy(event.target as HTMLElement);
};

export class CytoscapeContextMenu extends React.PureComponent<Props> {
  private readonly contextMenuRef: React.RefObject<ContextMenuContainer>;

  constructor(props: Props) {
    super(props);
    this.contextMenuRef = React.createRef<ContextMenuContainer>();
  }

  // Connects cy to this component
  connectCy(cy: any) {
    cy.on('cxttapstart taphold', (event: any) => {
      event.preventDefault();
      if (event.target) {
        const currentContextMenu = this.getCurrentContextMenu();
        if (currentContextMenu) {
          currentContextMenu.hide(0); // hide it in 0ms
        }

        let contextMenuContent: ContextMenuEdgeComponent | ContextMenuNodeComponent | undefined;

        if (event.target === cy) {
          contextMenuContent = undefined;
        } else if (event.target.isNode() && event.target.isParent()) {
          contextMenuContent = this.props.groupContextMenuContent;
        } else if (event.target.isNode()) {
          contextMenuContent = this.props.nodeContextMenuContent;
        } else if (event.target.isEdge()) {
          contextMenuContent = this.props.edgeContextMenuContent;
        }

        if (contextMenuContent) {
          this.makeContextMenu(contextMenuContent, event.target);
        }
      }
      return false;
    });
  }

  render() {
    return (
      <div className="hidden">
        <div ref={this.contextMenuRef} />
      </div>
    );
  }

  private getCurrentContextMenu() {
    return this.contextMenuRef!.current!._contextMenu;
  }

  private setCurrentContextMenu(current: any) {
    this.contextMenuRef!.current!._contextMenu = current;
  }

  private tippyDistance(target: any) {
    if (target.isNode === undefined || target.isNode()) {
      return 10;
    }
    return -30;
  }

  private makeContextMenu(ContextMenuComponentClass: ContextMenuEdgeComponent | ContextMenuNodeComponent, target: any) {
    const content = this.contextMenuRef.current;
    const tippyInstance = tippy(target.popperRef(), {
      content: content as HTMLDivElement,
      trigger: 'manual',
      arrow: true,
      placement: 'bottom',
      hideOnClick: true,
      multiple: false,
      sticky: true,
      interactive: true,
      theme: 'light-border',
      size: 'large',
      distance: this.tippyDistance(target)
    }).instances[0];

    ReactDOM.render(
      <ContextMenuComponentClass element={target} contextMenu={tippyInstance} {...target.data()} />,
      content,
      () => {
        this.setCurrentContextMenu(tippyInstance);
        tippyInstance.show();
      }
    );
  }
}
