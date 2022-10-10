import { Flex, FlexItem, Popover } from '@patternfly/react-core';
import {
  CubeIcon,
  CubesIcon,
  LevelDownAltIcon,
  FilterIcon,
  InfoCircleIcon,
  OutlinedHddIcon,
  QuestionCircleIcon,
  ServiceIcon,
  ThumbtackIcon,
  TimesIcon,
  UsersIcon
} from '@patternfly/react-icons';
import {
  Decorator,
  DEFAULT_DECORATOR_RADIUS,
  getDefaultShapeDecoratorCenter,
  Node,
  NodeShape,
  observer,
  Point,
  ScaleDetailsLevel,
  ShapeProps,
  TopologyQuadrant,
  WithDragNodeProps,
  WithSelectionProps
} from '@patternfly/react-topology';
import BaseNode from '../components/node';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import * as React from 'react';

export const FILTER_EVENT = 'filter';
export const STEP_INTO_EVENT = 'step_into';
export enum DataTypes {
  Default
}
const ICON_PADDING = 20;

type StyleNodeProps = {
  element: Node;
  getCustomShape?: (node: Node) => React.FC<ShapeProps>;
  getShapeDecoratorCenter?: (quadrant: TopologyQuadrant, node: Node, radius?: number) => { x: number; y: number };
  showLabel?: boolean;
  showStatusDecorator?: boolean;
  regrouping?: boolean;
  dragging?: boolean;
} & WithDragNodeProps &
  WithSelectionProps;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTypeIcon = (dataType?: string): React.ComponentClass<any, any> => {
  /*TODO: try using console ResourceIcon when available
   * https://issues.redhat.com/browse/CONSOLE-3140
   */
  switch (dataType) {
    case 'Service':
      return ServiceIcon;
    case 'Pod':
      return CubeIcon;
    case 'Namespace':
      return UsersIcon;
    case 'Node':
      return OutlinedHddIcon;
    case 'CatalogSource':
    case 'DaemonSet':
    case 'Deployment':
    case 'StatefulSet':
    case 'Job':
      return CubesIcon;
    default:
      return QuestionCircleIcon;
  }
};

const getTypeIconColor = (dataType?: string): string => {
  switch (dataType) {
    case 'Service':
    case 'Pod':
    case 'Namespace':
    case 'Node':
    case 'CatalogSource':
    case 'DaemonSet':
    case 'Deployment':
    case 'StatefulSet':
    case 'Job':
      return '#393F44';
    default:
      return '#c9190b';
  }
};

const renderIcon = (data: { type?: string }, element: Node): React.ReactNode => {
  const { width, height } = element.getDimensions();
  const shape = element.getNodeShape();
  const iconSize =
    (shape === NodeShape.trapezoid ? width : Math.min(width, height)) -
    (shape === NodeShape.stadium ? 5 : ICON_PADDING) * 2;
  const Component = getTypeIcon(data.type);
  const color = getTypeIconColor(data.type);

  return (
    <g transform={`translate(${(width - iconSize) / 2}, ${(height - iconSize) / 2})`}>
      <Component style={{ color }} width={iconSize} height={iconSize} />
    </g>
  );
};

const renderPopoverDecorator = (
  element: Node,
  quadrant: TopologyQuadrant,
  icon: React.ReactNode,
  data: { name?: string; type?: string; namespace?: string; addr?: string; host?: string },
  getShapeDecoratorCenter?: (
    quadrant: TopologyQuadrant,
    node: Node,
    radius?: number
  ) => {
    x: number;
    y: number;
  }
): React.ReactNode => {
  const { x, y } = getShapeDecoratorCenter
    ? getShapeDecoratorCenter(quadrant, element)
    : getDefaultShapeDecoratorCenter(quadrant, element);

  const t = val => {
    return val;
  };
  return (
    (data.type || data.namespace || data.name || data.addr || data.host) && (
      <Popover
        id="decorator"
        hideOnOutsideClick={true}
        onShow={() => {
          element.setData({
            ...element.getData(),
            hover: true //force hover state when popover is opened
          });
        }}
        onHide={() => {
          element.setData({
            ...element.getData(),
            hover: undefined //restore hover state when popover is closed
          });
        }}
        hasAutoWidth
        headerContent={
          //namespace is optional here for Node and Namespace kinds
          data.type && data.name
            ? // <ResourceLink inline={true} kind={data.type} name={data.name} namespace={data.namespace} />
              data.addr
            : data.addr
        }
        bodyContent={
          <Flex>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsNone' }}>
              {data.type && (
                <FlexItem>
                  <FlexItem>{t('Kind')}</FlexItem>
                </FlexItem>
              )}
              {data.namespace && (
                <FlexItem>
                  <FlexItem>{t('Namespace')}</FlexItem>
                </FlexItem>
              )}
              {data.name && (
                <FlexItem>
                  <FlexItem>{t('Name')}</FlexItem>
                </FlexItem>
              )}
              {data.addr && (
                <FlexItem>
                  <FlexItem>{t('IP')}</FlexItem>
                </FlexItem>
              )}
              {data.host && (
                <FlexItem>
                  <FlexItem>{t('Node')}</FlexItem>
                </FlexItem>
              )}
            </Flex>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsNone' }}>
              {data.type && <FlexItem>{data.type}</FlexItem>}
              {data.namespace && <FlexItem>{data.namespace}</FlexItem>}
              {data.name && <FlexItem>{data.name}</FlexItem>}
              {data.addr && <FlexItem>{data.addr}</FlexItem>}
              {data.host && <FlexItem>{data.host}</FlexItem>}
            </Flex>
          </Flex>
        }
      >
        <Decorator x={x} y={y} radius={DEFAULT_DECORATOR_RADIUS} showBackground icon={icon} />
      </Popover>
    )
  );
};

const renderClickableDecorator = (
  element: Node,
  quadrant: TopologyQuadrant,
  icon: React.ReactNode,
  isPinned: boolean,
  onClick: (element: Node) => void,
  getShapeDecoratorCenter?: (
    quadrant: TopologyQuadrant,
    node: Node,
    radius?: number
  ) => {
    x: number;
    y: number;
  }
): React.ReactNode => {
  const { x, y } = getShapeDecoratorCenter
    ? getShapeDecoratorCenter(quadrant, element)
    : getDefaultShapeDecoratorCenter(quadrant, element);

  return (
    <Decorator
      x={x}
      y={y}
      radius={DEFAULT_DECORATOR_RADIUS}
      showBackground
      icon={icon}
      className={isPinned ? 'selected-decorator' : ''}
      onClick={() => onClick(element)}
    />
  );
};

const renderDecorators = (
  element: Node,
  data: {
    showDecorators?: boolean;
    name?: string;
    type?: string;
    namespace?: string;
    addr?: string;
    host?: string;
    point?: Point;
    isPinned?: boolean;
    setPosition?: (location: Point) => void;
    canStepInto?: boolean;
  },
  isPinned: boolean,
  setPinned: (v: boolean) => void,
  isFiltered: boolean,
  setFiltered: (v: boolean) => void,
  // getShapeDecoratorCenter?: (
  //   quadrant: TopologyQuadrant,
  //   node: Node,
  //   radius?: number
  // ) => {
  //   x: number;
  //   y: number;
  // }
): React.ReactNode => {
  if (!data.showDecorators) {
    return null;
  }

  const onPinClick = () => {
    const updatedIsPinned = !isPinned;
    data.point = element.getPosition();
    data.isPinned = updatedIsPinned;
    //override setPosition when pinned
    if (updatedIsPinned) {
      data.setPosition = element.setPosition;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      element.setPosition = _p => {
        /*nothing to do there*/
      };
    } else {
      element.setPosition = data.setPosition!;
      data.setPosition = undefined;
    }
    element.setData(data);
    setPinned(updatedIsPinned);
  };

  const onFilterClick = () => {
    const updatedIsFiltered = !isFiltered;
    element.getController().fireEvent(FILTER_EVENT, {
      ...data,
      id: element.getId(),
      isFiltered: updatedIsFiltered
    });
    setFiltered(updatedIsFiltered);
  };

  const onStepIntoClick = () => {
    element.getController().fireEvent(STEP_INTO_EVENT, {
      ...data,
      id: element.getId()
    });
  };

  // const t = val => {
  //   return val;
  // };
  return (
    <>
      {data.canStepInto &&
        renderClickableDecorator(
          // t,
          element,
          TopologyQuadrant.upperLeft,
          <LevelDownAltIcon />,
          false,
          onStepIntoClick //,
          //getShapeDecoratorCenter
        )}
      {(data.namespace || data.name || data.addr || data.host) &&
        renderClickableDecorator(
          // t,
          element,
          TopologyQuadrant.lowerLeft,
          isFiltered ? <TimesIcon /> : <FilterIcon />,
          false,
          onFilterClick //,
          //getShapeDecoratorCenter
        )}
      {renderClickableDecorator(
        // t,
        element,
        TopologyQuadrant.upperRight,
        <ThumbtackIcon />,
        isPinned,
        onPinClick //,
        // getShapeDecoratorCenter
      )}
      {renderPopoverDecorator(
        // t,
        element,
        TopologyQuadrant.lowerRight,
        <InfoCircleIcon />,
        data //,
        // getShapeDecoratorCenter
      )}
    </>
  );
};

const StyleNode: React.FC<StyleNodeProps> = ({ element, showLabel, dragging, regrouping, ...rest }) => {
  // const { t } = useTranslation('plugin__netobserv-plugin');
  const data = element.getData();
  //TODO: check if we can have intelligent pin on view change
  const [isPinned, setPinned] = React.useState<boolean>(data.isPinned);
  const [isFiltered, setFiltered] = React.useState<boolean>(data.isFiltered === true);
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

  const updatedRest = { ...rest };
  if (isPinned) {
    //check if position has changed = controller reset element and is not pinned anymore
    if (element.getPosition() !== data.point) {
      setPinned(false);
    } else {
      updatedRest.dragNodeRef = undefined;
    }
  }

  return (
    <BaseNode
      element={element}
      {...updatedRest}
      {...passedData}
      dragging={isPinned ? false : dragging}
      regrouping={isPinned ? false : regrouping}
      showLabel={detailsLevel === ScaleDetailsLevel.high && showLabel}
      showStatusBackground={detailsLevel === ScaleDetailsLevel.low}
      showStatusDecorator={detailsLevel === ScaleDetailsLevel.high && passedData.showStatusDecorator}
      attachments={
        detailsLevel === ScaleDetailsLevel.high &&
        renderDecorators(
          //t,\
          element,
          data,
          isPinned,
          setPinned,
          isFiltered,
          setFiltered
        ) // , rest.getShapeDecoratorCenter)
      }
    >
      {renderIcon(passedData, element)}
    </BaseNode>
  );
};

export default observer(StyleNode);
