import * as React from 'react';
import * as ReactDOM from 'react-dom';
import tippy, { Instance } from 'tippy.js';
import { DecoratedGraphEdgeData, DecoratedGraphNodeData } from '../../types/Graph';

type Props = {
  groupContextMenuContent?: NodeContextMenuType;
  nodeContextMenuContent?: NodeContextMenuType;
  edgeContextMenuContent?: EdgeContextMenuType;
};

type ContextMenuContainer = HTMLDivElement & {
  _contextMenu: any;
};

type TippyInstance = Instance;

type ContextMenuProps = {
  element: any;
  contextMenu: TippyInstance;
};

export type NodeContextMenuProps = DecoratedGraphNodeData & ContextMenuProps;
export type EdgeContextMenuProps = DecoratedGraphEdgeData & ContextMenuProps;

export type NodeContextMenuType = React.ComponentType<NodeContextMenuProps>;
export type EdgeContextMenuType = React.ComponentType<EdgeContextMenuProps>;

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

export class CytoscapeContextMenuWrapper extends React.PureComponent<Props> {
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

        let contextMenuComponentType: EdgeContextMenuType | NodeContextMenuType | undefined;

        if (event.target === cy) {
          contextMenuComponentType = undefined;
        } else if (event.target.isNode() && event.target.isParent()) {
          contextMenuComponentType = this.props.groupContextMenuContent;
        } else if (event.target.isNode()) {
          contextMenuComponentType = this.props.nodeContextMenuContent;
        } else if (event.target.isEdge()) {
          contextMenuComponentType = this.props.edgeContextMenuContent;
        }

        if (contextMenuComponentType) {
          this.makeContextMenu(contextMenuComponentType, event.target);
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

  private makeContextMenu(ContextMenuComponentClass: EdgeContextMenuType | NodeContextMenuType, target: any) {
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
