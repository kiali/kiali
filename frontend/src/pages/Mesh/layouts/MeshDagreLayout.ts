import * as dagre from '@dagrejs/dagre';
import {
  BaseLayout,
  DagreLayoutOptions,
  Dimensions,
  Edge,
  GRAPH_LAYOUT_END_EVENT,
  Graph,
  LAYOUT_DEFAULTS,
  Layout,
  LayoutGroup,
  LayoutLink,
  LayoutNode,
  Node,
  NodeStyle,
  Point,
  Rect,
  getClosestVisibleParent,
  isNode
} from '@patternfly/react-topology';
import { GridNode } from '@patternfly/react-topology/dist/esm/layouts/GridNode';
import { DagreNode } from '@patternfly/react-topology/dist/esm/layouts/DagreNode';
import { DagreLink } from '@patternfly/react-topology/dist/esm/layouts/DagreLink';

export interface ChildGroup {
  group: LayoutGroup;
  nodes: LayoutNode[];
  edges: LayoutLink[];
  groups: LayoutGroup[];
}

// MeshDagreLayout is a copy of PFT's DagreGroupsLayout, but for innermost groups it copies the simple
// logic of GridLayout, which works better when organizing nodes with few, or no edges.
export class MeshDagreLayout extends BaseLayout implements Layout {
  protected dagreOptions: DagreLayoutOptions;

  constructor(graph: Graph, options?: Partial<DagreLayoutOptions>) {
    super(graph, options);
    this.dagreOptions = {
      ...this.options,
      layoutOnDrag: false,
      marginx: 0,
      marginy: 0,
      nodesep: this.options.nodeDistance,
      edgesep: this.options.linkDistance,
      rankdir: 'LR',
      ranker: 'tight-tree',
      ...options
    };
  }

  protected createLayoutNode(node: Node, nodeDistance: number, index: number) {
    return new DagreNode(node, nodeDistance, index);
  }

  protected createLayoutLink(edge: Edge, source: LayoutNode, target: LayoutNode, isFalse: boolean = false): LayoutLink {
    return new DagreLink(edge, source, target, isFalse);
  }

  protected updateEdgeBendpoints(edges: DagreLink[]): void {
    edges.forEach(edge => {
      const link = edge as DagreLink;
      link.updateBendpoints();
    });
  }

  protected getFauxEdges(): LayoutLink[] {
    return [];
  }

  protected getAllLeaves(group: LayoutGroup): LayoutNode[] {
    const leaves = [...group.leaves];
    group.groups?.forEach(subGroup => leaves.push(...this.getAllLeaves(subGroup)));
    return leaves;
  }
  protected getAllSubGroups(group: LayoutGroup): LayoutGroup[] {
    const groups = [...group.groups];
    group.groups?.forEach(subGroup => groups.push(...this.getAllSubGroups(subGroup)));
    return groups;
  }

  protected isNodeInGroups(node: LayoutNode, groups: LayoutGroup[]): boolean {
    return !!groups.find(group => group.leaves.includes(node) || this.isNodeInGroups(node, group.groups));
  }

  protected getEdgeLayoutNode(nodes: LayoutNode[], groups: LayoutGroup[], node: Node | null): LayoutNode | undefined {
    if (!node) {
      return undefined;
    }

    let layoutNode = nodes.find(n => n.id === node.getId());
    if (!layoutNode) {
      const groupNode = groups.find(n => n.id === node.getId());
      if (groupNode) {
        const dagreNode = new DagreNode(groupNode.element, groupNode.padding);
        if (dagreNode) {
          return dagreNode;
        }
      }
    }

    if (!layoutNode && node.getNodes().length) {
      const id = node.getChildren()[0].getId();
      layoutNode = nodes.find(n => n.id === id);
    }
    if (!layoutNode) {
      layoutNode = this.getEdgeLayoutNode(nodes, groups, getClosestVisibleParent(node));
    }

    return layoutNode;
  }

  protected getLinks(edges: Edge[]): LayoutLink[] {
    const links: LayoutLink[] = [];
    edges.forEach(e => {
      const source = this.getEdgeLayoutNode(this.nodes, this.groups, e.getSource());
      const target = this.getEdgeLayoutNode(this.nodes, this.groups, e.getTarget());
      if (source && target) {
        this.initializeEdgeBendpoints(e);
        links.push(this.createLayoutLink(e, source, target));
      }
    });

    return links;
  }

  protected startLayout(graph: Graph, initialRun: boolean, addingNodes: boolean): void {
    if (initialRun || addingNodes) {
      const doLayout = (parentGroup?: LayoutGroup) => {
        const dagreGraph = new dagre.graphlib.Graph({ compound: true });
        const options = { ...this.dagreOptions };

        Object.keys(LAYOUT_DEFAULTS).forEach(key => delete options[key]);
        dagreGraph.setGraph(options);

        // Determine the groups, nodes, and edges that belong in this layout
        const layerGroups = this.groups.filter(
          group => group.parent?.id === parentGroup?.id || (!parentGroup && group.parent?.id === graph.getId())
        );
        const layerNodes = this.nodes.filter(
          n =>
            n.element.getParent()?.getId() === parentGroup?.id ||
            (!parentGroup && n.element.getParent()?.getId() === graph.getId())
        );
        const layerEdges = this.edges.filter(
          edge =>
            (layerGroups.find(n => n.id === edge.sourceNode.id) || layerNodes.find(n => n.id === edge.sourceNode.id)) &&
            (layerGroups.find(n => n.id === edge.targetNode.id) || layerNodes.find(n => n.id === edge.targetNode.id))
        );

        // Layout any child groups first
        layerGroups.forEach(group => {
          doLayout(group);

          // Add the child group node (now with the correct dimensions) to the graph
          const dagreNode = new DagreNode(group.element, group.padding);
          const updateNode = dagreNode.getUpdatableNode();
          dagreGraph.setNode(group.id, updateNode);
        });

        if (layerGroups.length > 0) {
          layerNodes?.forEach(node => {
            const updateNode = (node as DagreNode).getUpdatableNode();
            dagreGraph.setNode(node.id, updateNode);
          });

          layerEdges?.forEach(dagreEdge => {
            dagreGraph.setEdge(dagreEdge.source.id, dagreEdge.target.id, dagreEdge);
          });

          dagre.layout(dagreGraph);

          // Update the node element positions
          layerNodes.forEach(node => {
            (node as DagreNode).updateToNode(dagreGraph.node(node.id));
          });

          // Update the group element positions (setting the group's positions updates its children)
          layerGroups.forEach(node => {
            const dagreNode = dagreGraph.node(node.id);
            node.element.setPosition(new Point(dagreNode.x, dagreNode.y));
          });

          this.updateEdgeBendpoints(this.edges as DagreLink[]);
        } else {
          const gridNodes = layerNodes.map(ln => new GridNode(ln.element, ln.distance, ln.index));

          gridNodes.sort((a, b) => {
            const aName = a.element.getData().infraName;
            const bName = b.element.getData().infraName;
            return aName.localeCompare(bName);
          });
          const totalNodes = gridNodes.length;
          const maxPerRow = Math.round(Math.sqrt(totalNodes));
          let x = 0;
          let y = 0;
          let rowI = 0;
          let padX = 0;
          let padY = 0;
          for (let i = 0; i < totalNodes; i++) {
            const node = gridNodes[i];
            if (padX < node.width) {
              padX = node.width;
            }
            if (padY < node.height) {
              padY = node.height;
            }
          }
          for (let i = 0; i < totalNodes; i++) {
            const node = gridNodes[i];
            node.x = x;
            node.y = y;
            node.update();

            if (rowI < maxPerRow) {
              x += padX;
              rowI++;
            } else {
              rowI = 0;
              x = 0;
              y += padY;
            }
          }
        }

        // now that we've laid out the children, set the dimensions on the group (not on the graph)
        if (parentGroup) {
          parentGroup.element.setDimensions(this.getGroupChildrenDimensions(parentGroup.element));
        }
      };

      // handle innermost group members as a grid
      // - adapted from PFT's GridLayout

      doLayout();
    }

    if (this.dagreOptions.layoutOnDrag) {
      this.forceSimulation.useForceSimulation(this.nodes, this.edges, this.getFixedNodeDistance);
    } else {
      this.graph.getController().fireEvent(GRAPH_LAYOUT_END_EVENT, { graph: this.graph });
    }
  }

  getGroupChildrenDimensions = (group: Node): Dimensions => {
    const children = group
      .getChildren()
      .filter(isNode)
      .filter(n => n.isVisible());
    if (!children.length) {
      return new Dimensions(0, 0);
    }

    let rect: Rect | undefined;
    children.forEach(c => {
      if (isNode(c)) {
        const { padding } = c.getStyle<NodeStyle>();
        const b = c.getBounds();
        // Currently non-group nodes do not include their padding in the bounds
        if (!c.isGroup() && padding) {
          b.padding(c.getStyle<NodeStyle>().padding);
        }
        if (!rect) {
          rect = b.clone();
        } else {
          rect.union(b);
        }
      }
    });

    if (!rect) {
      rect = new Rect();
    }

    const { padding } = group.getStyle<NodeStyle>();
    const paddedRect = rect.padding(padding);

    return new Dimensions(paddedRect.width, paddedRect.height);
  };
}
