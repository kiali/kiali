import {
  ComponentFactory,
  GraphComponent,
  GraphElement,
  ModelKind,
  nodeDragSourceSpec,
  withContextMenu,
  withDragNode,
  withPanZoom,
  withSelection
} from '@patternfly/react-topology';
import * as React from 'react';
import { MeshEdge } from '../styles/MeshEdge';
import { MeshNode } from '../styles/MeshNode';
import { MeshGroup } from '../styles/MeshGroup';

// There are currently no actions to take on a mesh node, so these placeholders are just commented out

/*
type ContextMenuOptionPF = ContextMenuOption & {
  altClickHandler?: (node: GraphElement) => void;
  node?: GraphElement;
};

// There is no node-graph for mesh nodes, so currently this does nothing
const doubleTapHandler = (node: GraphElement) => {
  handleDoubleTap(node);
};

// There is no node-graph for mesh nodes, so currently this does nothing
const handleDoubleTap = (_doubleTapNode: GraphElement) => {
  return;
};
*/

// There are currently no actiones to take on a mesh node, so this returns an empty array
const nodeContextMenu = (_node: GraphElement): React.ReactElement[] => {
  return [];
};

export const meshComponentFactory: ComponentFactory = (
  kind: ModelKind,
  type: string
): React.FunctionComponent<any> | undefined => {
  switch (kind) {
    case ModelKind.edge:
      // Currently, no side panel for edges, nothing really to show but the connectivity
      // return withSelection({ multiSelect: false, controlled: false })(MeshEdge as any);
      return MeshEdge as any;
    case ModelKind.graph:
      return withSelection({ multiSelect: false, controlled: false })(withPanZoom()(GraphComponent));
    case ModelKind.node: {
      return withDragNode(nodeDragSourceSpec('node', true, true))(
        withContextMenu(e => nodeContextMenu(e))(
          withSelection({ multiSelect: false, controlled: false })((type === 'group' ? MeshGroup : MeshNode) as any)
        )
      );
    }
    default:
      return undefined;
  }
};
