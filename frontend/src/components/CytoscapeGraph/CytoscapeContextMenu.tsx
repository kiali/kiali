import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Cy from 'cytoscape';
import { RouterProvider } from 'react-router-dom-v5-compat';
import tippy, { Instance } from 'tippy.js';
import { DecoratedGraphEdgeData, DecoratedGraphNodeData } from '../../types/Graph';
import { PeerAuthentication } from '../../types/IstioObjects';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { Provider } from 'react-redux';
import { store } from '../../store/ConfigStore';
import { createRouter } from '../../app/History';
import { getOptions } from './ContextMenu/NodeContextMenu';
import { WizardAction, WizardMode } from '../IstioWizards/WizardActions';
import { Theme } from 'types/Common';
import { pathRoutes } from 'routes';

export type EdgeContextMenuProps = DecoratedGraphEdgeData & ContextMenuProps;
export type EdgeContextMenuComponentType = React.ComponentType<EdgeContextMenuProps>;
export type NodeContextMenuProps = DecoratedGraphNodeData &
  ContextMenuProps & {
    onDeleteTrafficRouting?: (key: string, serviceDetails: ServiceDetailsInfo) => void;
    onLaunchWizard?: (
      key: WizardAction,
      mode: WizardMode,
      namespace: string,
      serviceDetails: ServiceDetailsInfo,
      gateways: string[],
      peerAuths: PeerAuthentication[]
    ) => void;
  };
export type NodeContextMenuComponentType = React.ComponentType<NodeContextMenuProps>;
export type ContextMenuComponentType = EdgeContextMenuComponentType | NodeContextMenuComponentType;

type Props = {
  contextMenuEdgeComponent?: EdgeContextMenuComponentType;
  contextMenuNodeComponent?: NodeContextMenuComponentType;
  onDeleteTrafficRouting?: (key: string, serviceDetails: ServiceDetailsInfo) => void;
  onLaunchWizard?: (
    key: WizardAction,
    mode: WizardMode,
    namespace: string,
    serviceDetails: ServiceDetailsInfo,
    gateways: string[],
    peerAuths: PeerAuthentication[]
  ) => void;
  theme: string;
};

type TippyInstance = Instance;

type ContextMenuContainer = HTMLDivElement & {
  _contextMenu: TippyInstance;
};

type ContextMenuProps = {
  contextMenu: TippyInstance;
  element: Cy.NodeSingular | Cy.EdgeSingular;
  isHover: boolean;
};

export class CytoscapeContextMenuWrapper extends React.PureComponent<Props> {
  private readonly contextMenuRef: React.RefObject<ContextMenuContainer>;
  private isHover: boolean | undefined;

  constructor(props: Props) {
    super(props);
    this.contextMenuRef = React.createRef<ContextMenuContainer>();
    this.isHover = undefined;
  }

  componentDidMount(): void {
    document.addEventListener('mouseup', this.handleDocumentMouseUp);
  }

  componentWillUnmount(): void {
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
  }

  render(): React.ReactNode {
    return (
      <div className="hidden">
        <div ref={this.contextMenuRef} />
      </div>
    );
  }

  // Add cy listener for context menu events on nodes and edges
  connectCy = (cy: Cy.Core): void => {
    cy.on('cxttapstart', 'node,edge', (event: Cy.EventObject) => {
      event.preventDefault();

      if (event.target) {
        this.handleContextMenu(event.target, false);
      }

      return false;
    });
  };

  // Connects cy to this component
  handleContextMenu = (elem: Cy.NodeSingular | Cy.EdgeSingular, isHover: boolean): void => {
    const contextMenuType = elem.isNode() ? this.props.contextMenuNodeComponent : this.props.contextMenuEdgeComponent;

    if (contextMenuType) {
      this.makeContextMenu(contextMenuType, elem, isHover, elem.isNode());
    }
  };

  hideContextMenu = (isHover: boolean | undefined): void => {
    const currentContextMenu = this.getCurrentContextMenu();

    if (currentContextMenu) {
      if (!isHover || this.isHover) {
        currentContextMenu.hide(0); // hide it in 0ms
        this.isHover = undefined;
        ReactDOM.unmountComponentAtNode(this.contextMenuRef.current as HTMLDivElement);
      }
    }
  };

  private handleDocumentMouseUp = (event: MouseEvent): void => {
    if (event.button === 2) {
      // Ignore mouseup of right button
      return;
    }

    const currentContextMenu: Instance | undefined = this.getCurrentContextMenu();

    if (currentContextMenu) {
      // Allow interaction in our popper component (Selecting and copying) without it disappearing
      if (event.target && currentContextMenu.popper.contains(event.target as Node)) {
        return;
      }

      this.hideContextMenu(this.isHover);
    }
  };

  private makeContextMenu = (
    ContextMenuComponentType: ContextMenuComponentType,
    target: Cy.NodeSingular | Cy.EdgeSingular,
    isHover: boolean,
    isNode: boolean
  ): void => {
    // Don't let a hover trump a non-hover context menu
    if (isHover && this.isHover === false) {
      return;
    }
    // If there is no valid context menu just return
    if (!isHover && (target.isEdge() || getOptions({ ...target.data() }).length === 0)) {
      return;
    }

    // hide any existing context menu
    this.hideContextMenu(isHover);

    // Prevent the tippy content from picking up the right-click when we are moving it over to the edge/node
    this.addContextMenuEventListener();
    const content = this.contextMenuRef.current;

    const tippyInstance = tippy(
      (target as any).popperRef(), // Using an extension, popperRef is not in base definition
      {
        content: content as HTMLDivElement,
        trigger: 'manual',
        arrow: true,
        placement: 'bottom',
        hideOnClick: false,
        multiple: false,
        sticky: true,
        interactive: true,
        theme: this.props.theme === Theme.DARK ? '' : 'light-border',
        size: 'large',
        distance: this.tippyDistance(target)
      }
    ).instances[0];

    let menuComponent = (
      <ContextMenuComponentType element={target} contextMenu={tippyInstance} isHover={isHover} {...target.data()} />
    );

    if (isNode) {
      menuComponent = (
        <ContextMenuComponentType
          element={target}
          contextMenu={tippyInstance}
          isHover={isHover}
          onDeleteTrafficRouting={this.props.onDeleteTrafficRouting}
          onLaunchWizard={this.props.onLaunchWizard}
          {...target.data()}
        />
      );
    }

    const contextMenuRouter = createRouter([
      {
        element: menuComponent,
        children: pathRoutes
      }
    ]);

    const result = (
      <Provider store={store}>
        <RouterProvider router={contextMenuRouter} />
      </Provider>
    );

    // save the context menu type to make sure we don't hide full context menus
    this.isHover = isHover;

    ReactDOM.render(result, content, () => {
      this.setCurrentContextMenu(tippyInstance);
      tippyInstance.show();

      // Schedule the removal of the contextmenu listener after finishing with the show procedure, so we can
      // interact with the popper content e.g. select and copy (with right click) values from it.
      setTimeout(() => {
        this.removeContextMenuEventListener();
      }, 0);
    });
  };

  private getCurrentContextMenu = (): Instance | undefined => {
    return this.contextMenuRef?.current?._contextMenu;
  };

  private setCurrentContextMenu = (current: TippyInstance): void => {
    this.contextMenuRef!.current!._contextMenu = current;
  };

  private addContextMenuEventListener = (): void => {
    document.addEventListener('contextmenu', this.handleContextMenuEvent);
  };

  private removeContextMenuEventListener = (): void => {
    document.removeEventListener('contextmenu', this.handleContextMenuEvent);
  };

  private handleContextMenuEvent = (event: MouseEvent): boolean => {
    // Disable the context menu in popper
    const currentContextMenu = this.getCurrentContextMenu();

    if (currentContextMenu) {
      if (event.target && currentContextMenu.popper.contains(event.target as Node)) {
        event.preventDefault();
      }
    }

    return true;
  };

  private tippyDistance = (_target: Cy.NodeSingular | Cy.EdgeSingular): number => {
    return 10;
  };
}
