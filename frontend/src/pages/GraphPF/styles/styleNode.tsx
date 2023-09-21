import { Node, NodeShape, observer, ScaleDetailsLevel, useHover, WithSelectionProps } from '@patternfly/react-topology';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import * as React from 'react';
import { KeyIcon, TopologyIcon } from '@patternfly/react-icons';
import { BaseNode } from '../components/node';

// This is the registered Node component override that utilizes our customized Node.tsx component.

type StyleNodeProps = {
  element: Node;
} & WithSelectionProps;

const renderIcon = (element: Node): React.ReactNode => {
  let Component: React.ComponentClass<React.ComponentProps<any>> | undefined;
  const data = element.getData();
  const isInaccessible = data.isInaccessible;
  const isServiceEntry = data.isServiceEntry;
  const isBox = data.isBox;
  if (isInaccessible && !isServiceEntry && !isBox) {
    Component = KeyIcon;
  }
  const isOutside = data.isOutside;
  if (isOutside && !isBox) {
    Component = TopologyIcon;
  }

  // this blurb taken from PFT demo StyleNode.tsx, not sure if it's required
  // vv
  const { width, height } = element.getDimensions();
  const shape = element.getNodeShape();
  const iconSize =
    (shape === NodeShape.trapezoid ? width : Math.min(width, height)) - (shape === NodeShape.stadium ? 5 : 20) * 2;
  // ^^

  return Component ? (
    <g transform={`translate(${(width - iconSize) / 2}, ${(height - iconSize) / 2})`}>
      <Component width={iconSize} height={iconSize} />
    </g>
  ) : (
    <></>
  );
};

const StyleNodeComponent: React.FC<StyleNodeProps> = ({ element, ...rest }) => {
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

  if (data.isFocused) {
    element.setData({ ...data, isFocused: false });
  }

  return (
    <g ref={hoverRef as any}>
      <BaseNode
        element={element}
        {...rest}
        {...passedData}
        attachments={hover || detailsLevel === ScaleDetailsLevel.high ? data.attachments : undefined}
        scaleLabel={hover && detailsLevel !== ScaleDetailsLevel.high}
        // scaleNode={hover && detailsLevel === ScaleDetailsLevel.low}
        showLabel={hover || detailsLevel === ScaleDetailsLevel.high}
        showStatusBackground={detailsLevel === ScaleDetailsLevel.low}
      >
        {(hover || detailsLevel !== ScaleDetailsLevel.low) && renderIcon(element)}
      </BaseNode>
    </g>
  );
};

export const StyleNode = observer(StyleNodeComponent);
