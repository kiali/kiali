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
import { StyleEdge } from '../styles/MeshEdge';
import { StyleGroup } from '../styles/MeshGroup';
import { StyleNode } from '../styles/MeshNode';

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
      return withSelection({ multiSelect: false, controlled: false })(StyleEdge as any);
    case ModelKind.graph:
      return withPanZoom()(GraphComponent);
    case ModelKind.node: {
      return withDragNode(nodeDragSourceSpec('node', true, true))(
        withContextMenu(e => nodeContextMenu(e))(
          withSelection({ multiSelect: false, controlled: false })((type === 'group' ? StyleGroup : StyleNode) as any)
        )
      );
    }
    default:
      return undefined;
  }
};
