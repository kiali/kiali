import * as React from 'react';
import { CubesIcon } from '@patternfly/react-icons';
import {
  DefaultGroup,
  Node,
  observer,
  ScaleDetailsLevel,
  ShapeProps,
  WithSelectionProps
} from '@patternfly/react-topology';
import { useDetailsLevel } from '@patternfly/react-topology';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

const ICON_PADDING = 20;

export enum DataTypes {
  Default
}

type MeshGroupProps = {
  collapsedHeight?: number;
  collapsedShadowOffset?: number; // defaults to 10
  collapsedWidth?: number;
  collapsible: boolean;
  element: Node;
  getCollapsedShape?: (node: Node) => React.FC<ShapeProps>;
  onCollapseChange?: (group: Node, collapsed: boolean) => void;
} & WithSelectionProps;

const MeshGroupComponent: React.FC<MeshGroupProps> = ({
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

  // the selected group has an active border, but the background remains unchanged
  const selectedGroupStyle = {
    $nest: {
      '& .pf-topology__group__background': {
        fill: PFColors.BackgroundColorLight300,
        stroke: PFColors.Active
      },
      '&.pf-m-alt-group .pf-topology__group__background': {
        fill: 'var(--pf-topology__group--m-alt-group--topology__group__background--Fill)',
        stroke: PFColors.Active
      }
    }
  };

  const groupStyle = kialiStyle({
    $nest: {
      '&.pf-m-selected': selectedGroupStyle,
      '&.pf-m-selected.pf-m-hover': selectedGroupStyle,
      '&.pf-m-hover .pf-topology__group__background': {
        stroke: PFColors.Color200
      }
    }
  });

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
        className={groupStyle}
        collapsedWidth={collapsedWidth}
        collapsedHeight={collapsedHeight}
        element={element}
        hulledOutline={false}
        showLabel={detailsLevel !== ScaleDetailsLevel.low}
        showLabelOnHover={true}
        {...rest}
        {...passedData}
      >
        {element.isCollapsed() ? renderIcon() : null}
      </DefaultGroup>
    </g>
  );
};

export const MeshGroup = observer(MeshGroupComponent);
