import { Node, observer, ScaleDetailsLevel, WithSelectionProps } from '@patternfly/react-topology';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import * as React from 'react';
import BaseNode from '../components/node';

// This is the registered Node component override that utilizes our customized Edge.tsx component.

type StyleNodeProps = {
  element: Node;
} & WithSelectionProps;

const StyleNode: React.FC<StyleNodeProps> = ({ element, ...rest }) => {
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

  return (
    <BaseNode
      element={element}
      {...rest}
      {...passedData}
      showLabel={detailsLevel === ScaleDetailsLevel.high}
      showStatusBackground={detailsLevel === ScaleDetailsLevel.low}
    />
  );
};

export default observer(StyleNode);
