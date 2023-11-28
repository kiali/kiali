import { Edge, observer, ScaleDetailsLevel, WithSelectionProps } from '@patternfly/react-topology';
import { BaseEdge } from '../components/edge';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';

// This is the registered Edge component override that utilizes our customized Edge.tsx component.

type StyleEdgeProps = {
  element: Edge;
} & WithSelectionProps;

const tagClass = kialiStyle({
  fontFamily: 'Verdana,Arial,Helvetica,sans-serif,pficon'
});

const StyleEdgeComponent: React.FC<StyleEdgeProps> = ({ element, ...rest }) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();

  const passedData = React.useMemo(() => {
    const newData = { ...data };
    if (detailsLevel !== ScaleDetailsLevel.high) {
      newData.showTag = false;
    }
    Object.keys(newData).forEach(key => {
      if (newData[key] === undefined) {
        delete newData[key];
      }
    });
    return newData;
  }, [data, detailsLevel]);

  return <BaseEdge element={element} tagClass={tagClass} {...rest} {...passedData} />;
};

export const StyleEdge = observer(StyleEdgeComponent);
