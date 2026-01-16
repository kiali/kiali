import * as React from 'react';
import { Rectangle, ShapeProps } from '@patternfly/react-topology';

// Wrapper component for service nodes with cornerRadius = 0
export const RectSharp: React.FC<ShapeProps> = props => {
  return <Rectangle {...props} cornerRadius={4} />;
};
