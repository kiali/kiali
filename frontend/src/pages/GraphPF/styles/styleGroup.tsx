import { CubesIcon } from '@patternfly/react-icons';
import {
  DefaultGroup,
  Node,
  observer,
  ScaleDetailsLevel,
  ShapeProps,
  WithSelectionProps
} from '@patternfly/react-topology';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import { PFColors } from 'components/Pf/PfColors';
import React from 'react';

const ICON_PADDING = 20;

export enum DataTypes {
  Default
}

type StyleGroupProps = {
  collapsedHeight?: number;
  collapsedShadowOffset?: number; // defaults to 10
  collapsedWidth?: number;
  collapsible: boolean;
  element: Node;
  getCollapsedShape?: (node: Node) => React.FC<ShapeProps>;
  onCollapseChange?: (group: Node, collapsed: boolean) => void;
} & WithSelectionProps;

const StyleGroupComponent: React.FC<StyleGroupProps> = ({
  collapsedHeight = 75,
  collapsedWidth = 75,
  element,
  ...rest
}) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();

  // Set the path style when unhighlighted (opacity)
  let opacity = 1;
  if (data.isUnhighlighted) {
    opacity = 0.1;
  }

  const onMouseEnter = (): void => {
    data.onHover(element, true);
  };

  const onMouseLeave = (): void => {
    data.onHover(element, false);
  };

  const passedData = React.useMemo(() => {
    const newData = { ...data };
    Object.keys(newData).forEach(key => {
      if (newData[key] === undefined) {
        delete newData[key];
      }
    });
    return newData;
  }, [data]);

  const renderIcon = (): React.ReactNode => {
    const iconSize = Math.min(collapsedWidth, collapsedHeight) - ICON_PADDING * 2;
    const Component = CubesIcon;

    return (
      <g transform={`translate(${(collapsedWidth - iconSize) / 2}, ${(collapsedHeight - iconSize) / 2})`}>
        <Component style={{ color: PFColors.Color200 }} width={iconSize} height={iconSize} />
      </g>
    );
  };

  return (
    <g style={{ opacity: opacity }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <DefaultGroup
        element={element}
        collapsedWidth={collapsedWidth}
        collapsedHeight={collapsedHeight}
        showLabel={detailsLevel === ScaleDetailsLevel.high}
        {...rest}
        {...passedData}
      >
        {element.isCollapsed() ? renderIcon() : null}
      </DefaultGroup>
    </g>
  );
};

export const StyleGroup = observer(StyleGroupComponent);
