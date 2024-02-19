import { ElementFactory, GraphElement, ModelKind } from '@patternfly/react-topology';
import { ExtendedBaseEdge } from './extendedBaseEdge';

export const elementFactory: ElementFactory = (kind: ModelKind, _type: string): GraphElement | undefined => {
  switch (kind) {
    case ModelKind.edge:
      return new ExtendedBaseEdge();
    default:
      return undefined;
  }
};
