import * as webcola from 'webcola';
import * as d3 from 'd3';
import { action } from 'mobx';
import {
  BaseLayout,
  ColaGroup,
  ColaGroupsNode,
  ColaLayout,
  Graph,
  Layout,
  LayoutGroup,
  LayoutLink,
  LayoutNode,
  Node
} from '@patternfly/react-topology';
import { GridNode } from '@patternfly/react-topology/dist/esm/layouts/GridNode';

export interface ChildGroup {
  group: LayoutGroup;
  nodes: LayoutNode[];
  edges: LayoutLink[];
  groups: LayoutGroup[];
}

// MeshColaLayout is a copy of PFT's ColaGroupsLayout, but for innermost groups it copies the simple
// logic of GridLayout, which works better when organizing nodes with few, or no edges.
export class MeshColaLayout extends ColaLayout implements Layout {
  private layerNodes: LayoutNode[] = [];

  private layerGroupNodes: ChildGroup[] = [];

  private layerGroups: LayoutGroup[] = [];

  private layerEdges: LayoutLink[] = [];

  private layoutNodes: LayoutNode[] = [];

  private childLayouts: BaseLayout[] = [];

  protected initializeLayout(): void {
    console.log('init mesh layout');
  }

  protected initializeColaGroupLayout(graph: Graph): void {
    this.d3Cola = webcola.d3adaptor(d3);
    this.d3Cola.handleDisconnected(true);
    this.d3Cola.avoidOverlaps(true);
    this.d3Cola.jaccardLinkLengths(40, 0.7);
    this.d3Cola.on('tick', () => {
      this.tickCount++;
      if (this.tickCount >= 1 || this.tickCount % this.options.simulationSpeed === 0) {
        action(() => this.nodes.forEach(d => d.update()))();
      }
      if (this.colaOptions.maxTicks >= 0 && this.tickCount > this.colaOptions.maxTicks) {
        this.d3Cola.stop();
      }
    });
    this.d3Cola.on('end', () => {
      this.tickCount = 0;
      this.simulationRunning = false;
      action(() => {
        if (this.destroyed) {
          this.handleLayoutEnd();
          return;
        }
        this.layoutNodes.forEach(d => {
          if (!this.simulationStopped) {
            d.update();
          }
          d.setFixed(false);
        });
        if (this.options.layoutOnDrag) {
          this.forceSimulation.useForceSimulation(this.nodes, this.edges, this.getFixedNodeDistance);
        }
        if (this.simulationStopped) {
          this.simulationStopped = false;
          if (this.restartOnEnd !== undefined) {
            this.startColaLayout(false, this.restartOnEnd);
            this.startLayout(graph, false, this.restartOnEnd, this.handleLayoutEnd);
            // @ts-ignore
            delete this.restartOnEnd;
          } else {
            this.handleLayoutEnd();
          }
        } else if (this.addingNodes) {
          // One round of simulation to adjust for new nodes
          this.forceSimulation.useForceSimulation(this.nodes, this.edges, this.getFixedNodeDistance);
          this.forceSimulation.restart();
        } else {
          this.handleLayoutEnd();
        }
      })();
    });
  }

  protected stopSimulation(): void {
    super.stopSimulation();
    this.childLayouts.forEach(layout => layout.stop());
  }

  protected createLayoutNode(node: Node, nodeDistance: number, index: number) {
    return new ColaGroupsNode(node, nodeDistance, index);
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

  protected isNodeInChildGroups(node: LayoutNode, groups: ChildGroup[]): boolean {
    return !!groups.find(group => group.nodes.includes(node) || this.isNodeInGroups(node, group.groups));
  }

  protected isSubGroup(group: ChildGroup, childGroups: ChildGroup[]): boolean {
    return !!childGroups.find(cg => cg.groups.includes(group.group));
  }

  protected getNodeGroup(node: LayoutNode, childGroups: ChildGroup[]): ChildGroup | undefined {
    return childGroups.find(group => group.nodes.includes(node) || this.isNodeInGroups(node, group.groups));
  }

  protected getGroupLayout(
    graph: Graph,
    _group: LayoutGroup,
    nodes: LayoutNode[],
    edges: LayoutLink[],
    groups: LayoutGroup[]
  ): BaseLayout {
    const layout = new MeshColaLayout(graph, {
      ...this.options,
      onSimulationEnd: undefined,
      listenForChanges: false
    });
    layout.setupLayout(graph, nodes, edges, groups);
    return layout;
  }

  protected setupLayout(graph: Graph, nodes: LayoutNode[], edges: LayoutLink[], groups: LayoutGroup[]): void {
    const constraints = this.getConstraints(nodes as ColaGroupsNode[], groups as ColaGroup[], edges);
    let childGroups = groups.reduce((acc, group) => {
      if (
        !groups.find(g => group.element.getParent()?.getId() === g.element.getId()) &&
        (group.groups.length || group.leaves.length)
      ) {
        const allLeaves = this.getAllLeaves(group);
        const groupEdges = edges.filter(edge => allLeaves.includes(edge.sourceNode) && allLeaves.includes(edge.target));
        const groupGroups = this.getAllSubGroups(group);
        allLeaves.forEach((l, i) => {
          l.index = i;
          if (l.parent && !groupGroups.includes(l.parent)) {
            l.parent = undefined;
          }
        });
        groupGroups.forEach((g, i) => {
          g.index = 2 * allLeaves.length + i;
          g.parent = undefined;
        });

        acc.push({
          group,
          nodes: allLeaves,
          edges: groupEdges,
          groups: groupGroups
        });
      }
      return acc;
    }, [] as ChildGroup[]);
    const constrainedGroups = groups.filter(g => constraints.find(c => c.group === g.element.getId()));
    this.layerGroups = childGroups.filter(cg => constrainedGroups.includes(cg.group)).map(cg => cg.group);
    childGroups = childGroups.filter(cg => !this.layerGroups.includes(cg.group));
    this.layerNodes = nodes.filter(node => !this.isNodeInChildGroups(node, childGroups));
    this.layerGroupNodes = childGroups.filter(cg => !this.isSubGroup(cg, childGroups));
    this.layerEdges = edges.reduce((acc, edge) => {
      const source = this.getNodeGroup(edge.sourceNode, childGroups);
      const target = this.getNodeGroup(edge.targetNode, childGroups);
      if (!source || !target || source !== target) {
        acc.push(edge);
      }
      return acc;
    }, [] as LayoutLink[]);
    this.childLayouts = childGroups.map(childGroup =>
      this.getGroupLayout(graph, childGroup.group, childGroup.nodes, childGroup.edges, childGroup.groups)
    );
  }

  private startChildLayout(
    graph: Graph,
    childLayout: BaseLayout,
    initialRun: boolean,
    addingNodes: boolean
  ): Promise<void> {
    return new Promise<void>(resolve => {
      childLayout.doStartLayout(graph, initialRun, addingNodes, () => {
        resolve();
      });
    });
  }

  protected startColaLayout(initialRun: boolean, addingNodes: boolean): void {
    this.simulationRunning = true;
    this.tickCount = 0;
    this.addingNodes = addingNodes;

    // If there are group nodes then lay out via normal colagroups handling
    const doStartCola = () => {
      this.initializeColaGroupLayout(this.graph);
      const { width, height } = this.graph.getBounds();
      this.d3Cola.size([width, height]);
      this.layoutNodes = [...this.layerNodes];
      this.layerGroupNodes.forEach(cg => {
        const layoutNode = this.createLayoutNode(cg.group.element as Node, this.options.nodeDistance, cg.group.index);
        this.layoutNodes.push(layoutNode);
        this.layerEdges.forEach(edge => {
          if (cg.nodes.find(n => n.id === edge.sourceNode.id) || this.isNodeInGroups(edge.sourceNode, cg.groups)) {
            edge.sourceNode = layoutNode;
          }
          if (cg.nodes.find(n => n.id === edge.targetNode.id) || this.isNodeInGroups(edge.targetNode, cg.groups)) {
            edge.targetNode = layoutNode;
          }
        });
      });

      // Get any custom constraints
      const constraints = this.getConstraints(
        this.layoutNodes as ColaGroupsNode[],
        this.layerGroups as ColaGroup[],
        this.layerEdges
      );
      this.d3Cola.constraints(constraints);

      this.d3Cola.nodes(this.layoutNodes);
      this.d3Cola.groups(this.layerGroups);
      this.d3Cola.links(this.layerEdges);
      this.d3Cola.alpha(0.2);

      this.d3Cola.start(
        addingNodes ? 0 : this.colaOptions.initialUnconstrainedIterations,
        addingNodes ? 0 : this.colaOptions.initialUserConstraintIterations,
        addingNodes ? 0 : this.colaOptions.initialAllConstraintsIterations,
        addingNodes ? 0 : this.colaOptions.gridSnapIterations,
        false,
        !addingNodes
      );
    };

    // handle innermost group members as a grid
    // - adapted from PFT's GridLayout
    const doStartGrid = () => {
      this.layoutNodes = this.layerNodes.map(ln => new GridNode(ln.element, ln.distance, ln.index));

      this.layoutNodes.sort((a, b) => {
        const aName = a.element.getData().infraName;
        const bName = b.element.getData().infraName;
        return aName.localeCompare(bName);
      });
      const totalNodes = this.layoutNodes.length;
      const maxPerRow = Math.round(Math.sqrt(totalNodes));
      let x = 0;
      let y = 0;
      let rowI = 0;
      let padX = 0;
      let padY = 0;
      for (let i = 0; i < totalNodes; i++) {
        const node = this.layoutNodes[i];
        if (padX < node.width) {
          padX = node.width;
        }
        if (padY < node.height) {
          padY = node.height;
        }
      }
      for (let i = 0; i < totalNodes; i++) {
        const node = this.layoutNodes[i];
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
    };

    if (this.childLayouts?.length) {
      const runLayouts = (childLayouts: BaseLayout[]): Promise<void[]> =>
        Promise.all(
          childLayouts.map(childLayout => this.startChildLayout(this.graph, childLayout, initialRun, addingNodes))
        );

      runLayouts(this.childLayouts)
        .then(() => {
          doStartCola();
        })
        .catch(() => {});
      return;
    }

    doStartGrid();
  }
}
