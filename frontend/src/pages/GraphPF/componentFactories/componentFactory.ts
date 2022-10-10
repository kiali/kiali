import {
  ComponentFactory,
  DefaultEdge,
  DefaultGroup,
  DefaultNode,
  GraphComponent,
  GraphElement,
  ModelKind
} from '@patternfly/react-topology';
import { ComponentType } from 'react';

export const componentFactory: ComponentFactory = (
  kind: ModelKind,
  type: string
): ComponentType<{ element: GraphElement }> | undefined => {
  switch (type) {
    case 'group':
      // @ts-ignore
      return DefaultGroup;
    default:
      switch (kind) {
        case ModelKind.graph:
          // @ts-ignore
          return GraphComponent;
        case ModelKind.node:
          // @ts-ignore
          return DefaultNode;
        case ModelKind.edge:
          // @ts-ignore
          return DefaultEdge;
        default:
          return undefined;
      }
  }
};

export default componentFactory;
