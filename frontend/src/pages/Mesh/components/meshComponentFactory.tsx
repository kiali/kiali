import {
  ComponentFactory,
  GraphComponent,
  ModelKind,
  nodeDragSourceSpec,
  withDragNode,
  withPanZoom,
  withSelection
} from '@patternfly/react-topology';
import * as React from 'react';
import { MeshEdge } from '../styles/MeshEdge';
import { MeshNode } from '../styles/MeshNode';
import { MeshGroup } from '../styles/MeshGroup';

export const meshComponentFactory: ComponentFactory = (
  kind: ModelKind,
  type: string
): React.FunctionComponent<any> | undefined => {
  switch (kind) {
    case ModelKind.edge:
      // Currently, no side panel for edges, nothing really to show but the connectivity
      return MeshEdge as any;
    case ModelKind.graph:
      return withSelection({ multiSelect: false, controlled: false })(withPanZoom()(GraphComponent));
    case ModelKind.node: {
      return withDragNode(nodeDragSourceSpec('node', true, true))(
        withSelection({ multiSelect: false, controlled: false })((type === 'group' ? MeshGroup : MeshNode) as any)
      );
    }
    default:
      return undefined;
  }
};
