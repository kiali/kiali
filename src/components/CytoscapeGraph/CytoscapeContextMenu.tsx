import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Router } from 'react-router';
import tippy, { Instance } from 'tippy.js';
import { DecoratedGraphEdgeData, DecoratedGraphNodeData } from '../../types/Graph';
import { Provider } from 'react-redux';
import { store } from '../../store/ConfigStore';
import history from '../../app/History';

type Props = {
  groupContextMenuContent?: NodeContextMenuType;
  nodeContextMenuContent?: NodeContextMenuType;
  edgeContextMenuContent?: EdgeContextMenuType;
};

type TippyInstance = Instance;

type ContextMenuContainer = HTMLDivElement & {
  _contextMenu: TippyInstance;
};

type ContextMenuProps = {
  element: any;
  contextMenu: TippyInstance;
};

export type NodeContextMenuProps = DecoratedGraphNodeData & ContextMenuProps;
export type EdgeContextMenuProps = DecoratedGraphEdgeData & ContextMenuProps;

export type NodeContextMenuType = React.ComponentType<NodeContextMenuProps>;
export type EdgeContextMenuType = React.ComponentType<EdgeContextMenuProps>;

export class CytoscapeContextMenuWrapper extends React.PureComponent<Props> {
  private readonly contextMenuRef: React.RefObject<ContextMenuContainer>;

  constructor(props: Props) {
    super(props);
    this.contextMenuRef = React.createRef<ContextMenuContainer>();
  }

  componentDidMount() {
    document.addEventListener('mouseup', this.handleDocumentMouseUp);
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
  }

  handleDocumentMouseUp = (event: MouseEvent) => {
    if (event.button === 2) {
      // Ignore mouseup of right button
      return;
    }
    const currentContextMenu = this.getCurrentContextMenu();
    if (currentContextMenu) {
      // Allow interaction in our popper component (Selecting and copying) without it disappearing
      if (event.target && currentContextMenu.popper.contains(event.target as Node)) {
        return;
      }
      currentContextMenu.hide();
    }
  };

  handleContextMenu = (event: any) => {
    // Disable the context menu in popper
    const currentContextMenu = this.getCurrentContextMenu();
    if (currentContextMenu) {
      if (event.target && currentContextMenu.popper.contains(event.target as Node)) {
        event.preventDefault();
      }
    }
    return true;
  };

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

  private addContextMenuEventListener() {
    document.addEventListener('contextmenu', this.handleContextMenu);
  }

  private removeContextMenuEventListener() {
    document.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private makeContextMenu(ContextMenuComponentClass: EdgeContextMenuType | NodeContextMenuType, target: any) {
    // Prevent the tippy content from picking up the right-click when we are moving it over to the edge/node
    this.addContextMenuEventListener();
    const content = this.contextMenuRef.current;
    const tippyInstance = tippy(target.popperRef(), {
      content: content as HTMLDivElement,
      trigger: 'manual',
      arrow: true,
      placement: 'bottom',
      hideOnClick: false,
      multiple: false,
      sticky: true,
      interactive: true,
      theme: 'light-border',
      size: 'large',
      distance: this.tippyDistance(target)
    }).instances[0];

    const result = (
      <Provider store={store}>
        <Router history={history}>
          <ContextMenuComponentClass element={target} contextMenu={tippyInstance} {...target.data()} />
        </Router>
      </Provider>
    );

    ReactDOM.render(result, content, () => {
      this.setCurrentContextMenu(tippyInstance);
      tippyInstance.show();
      // Schedule the removal of the contextmenu listener after finishing with the show procedure, so we can
      // interact with the popper content e.g. select and copy (with right click) values from it.
      setTimeout(() => {
        this.removeContextMenuEventListener();
      }, 0);
    });
  }
}
