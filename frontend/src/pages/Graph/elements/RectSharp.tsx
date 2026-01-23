import * as React from 'react';
import { Rectangle, ShapeProps } from '@patternfly/react-topology';

// Wrapper component for service nodes, reducing rect's default  cornerRadius. This is not so much for
// performance as it is to give the graph nodes a more consistent looks, with only slightly rounded edges.
export const RectSharp: React.FC<ShapeProps> = props => {
  return <Rectangle {...props} cornerRadius={4} />;
};
