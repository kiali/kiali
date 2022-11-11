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
import StyleEdge from '../styles/styleEdge';
import StyleGroup from '../styles/styleGroup';
import StyleNode from '../styles/styleNode';

export const stylesComponentFactory: ComponentFactory = (
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
        withSelection({ multiSelect: false, controlled: false })((type === 'group' ? StyleGroup : StyleNode) as any)
      );
    }
    default:
      return undefined;
  }
};

export default stylesComponentFactory;
