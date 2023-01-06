import { Node, observer, ScaleDetailsLevel, useHover, WithSelectionProps } from '@patternfly/react-topology';
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
  const [hover, hoverRef] = useHover();

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
    <g ref={hoverRef as any}>
      <BaseNode
        element={element}
        {...rest}
        {...passedData}
        scaleLabel={hover && detailsLevel !== ScaleDetailsLevel.high}
        // scaleNode={hover && detailsLevel === ScaleDetailsLevel.low}
        showLabel={hover || detailsLevel === ScaleDetailsLevel.high}
        showStatusBackground={detailsLevel === ScaleDetailsLevel.low}
      />
    </g>
  );
};

export default observer(StyleNode);
