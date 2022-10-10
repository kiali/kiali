// import { ComponentType, ReactElement } from 'react';
import { ComponentFactory, DefaultNode } from '@patternfly/react-topology';

export const shapesComponentFactory: ComponentFactory = (
  // kind: ModelKind,
  type: string
): React.FunctionComponent<any> | undefined => {
  // ComponentType<{ element: GraphElement }> | undefined => {
  switch (type) {
    //TODO: try different shapes by Owner Kind for example
    case 'node':
      return DefaultNode;
    default:
      return undefined;
  }
};

export default shapesComponentFactory;
