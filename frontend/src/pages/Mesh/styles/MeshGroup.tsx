import { CubesIcon } from '@patternfly/react-icons';
import { Node, observer, ScaleDetailsLevel, ShapeProps, WithSelectionProps } from '@patternfly/react-topology';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import { PFColors } from 'components/Pf/PfColors';
import React from 'react';
import { BaseGroup } from '../components/group';

const ICON_PADDING = 20;

export enum DataTypes {
  Default
}

type StyleGroupProps = {
  element: Node;
  collapsible: boolean;
  collapsedWidth?: number;
  collapsedHeight?: number;
  onCollapseChange?: (group: Node, collapsed: boolean) => void;
  getCollapsedShape?: (node: Node) => React.FC<ShapeProps>;
  collapsedShadowOffset?: number; // defaults to 10
} & WithSelectionProps;

const StyleGroupComponent: React.FC<StyleGroupProps> = ({
  element,
  collapsedWidth = 75,
  collapsedHeight = 75,
  ...rest
}) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();

  const passedData = React.useMemo(() => {
    const newData = { ...data };
    Object.keys(newData).forEach(key => {
      if (newData[key] === undefined) {
        delete newData[key];
      }
    });
    return newData;
  }, [data]);

  if (data.isFocused) {
    element.setData({ ...data, isFocused: false });
  }

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
    <g>
      <BaseGroup
        element={element}
        collapsedWidth={collapsedWidth}
        collapsedHeight={collapsedHeight}
        showLabel={detailsLevel === ScaleDetailsLevel.high}
        {...rest}
        {...passedData}
      >
        {element.isCollapsed() ? renderIcon() : null}
      </BaseGroup>
    </g>
  );
};

export const StyleGroup = observer(StyleGroupComponent);
