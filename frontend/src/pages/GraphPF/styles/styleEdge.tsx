import { Edge, observer, ScaleDetailsLevel, WithSelectionProps } from '@patternfly/react-topology';
import BaseEdge from '../components/edge';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import * as React from 'react';

type StyleEdgeProps = {
  element: Edge;
} & WithSelectionProps;

const StyleEdge: React.FC<StyleEdgeProps> = ({ element, ...rest }) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();

  const passedData = React.useMemo(() => {
    const newData = { ...data };
    if (detailsLevel !== ScaleDetailsLevel.high) {
      newData.tag = undefined;
    }
    Object.keys(newData).forEach(key => {
      if (newData[key] === undefined) {
        delete newData[key];
      }
    });
    return newData;
  }, [data, detailsLevel]);

  return <BaseEdge element={element} {...rest} {...passedData} />;
};

export default observer(StyleEdge);
