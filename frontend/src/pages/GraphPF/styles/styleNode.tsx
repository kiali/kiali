import { Popover } from '@patternfly/react-core';
import { KeyIcon, GlobeIcon, TopologyIcon } from '@patternfly/react-icons';
import {
  Decorator,
  DefaultNode,
  DEFAULT_DECORATOR_RADIUS,
  getDefaultShapeDecoratorCenter,
  Node,
  NodeShape,
  observer,
  ScaleDetailsLevel,
  // ShapeProps,
  TopologyQuadrant,
  WithDragNodeProps,
  WithSelectionProps
} from '@patternfly/react-topology';
// import BaseNode from '../components/node';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import * as React from 'react';
import { NodeData } from '../GraphPFElems';
import { config } from 'config';
import { style } from 'typestyle';
import { PFColors } from 'components/Pf/PfColors';

// export const FILTER_EVENT = 'filter';
// export const STEP_INTO_EVENT = 'step_into';
// export enum DataTypes {
//   Default
// }

const ICON_PADDING = 20;

type StyleNodeProps = {
  element: Node;
  // getCustomShape?: (node: Node) => React.FC<ShapeProps>;
  // getShapeDecoratorCenter?: (quadrant: TopologyQuadrant, node: Node, radius?: number) => { x: number; y: number };
  // showLabel?: boolean;
  // showStatusDecorator?: boolean;
  // regrouping?: boolean;
  // dragging?: boolean;
} & WithDragNodeProps &
  WithSelectionProps;

const hostsList = style({
  textAlign: 'initial',
  marginTop: 2,
  paddingTop: 2,
  borderTop: `1px solid ${PFColors.Black600}`
});

const renderIcon = (element: Node): React.ReactNode => {
  let Component: React.ComponentClass<React.ComponentProps<any>> | undefined;
  const data = element.getData() as NodeData;
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

  const { width, height } = element.getDimensions();
  const shape = element.getNodeShape();
  const iconSize =
    (shape === NodeShape.trapezoid ? width : Math.min(width, height)) -
    (shape === NodeShape.stadium ? 5 : ICON_PADDING) * 2;

  return Component ? (
    <g transform={`translate(${(width - iconSize) / 2}, ${(height - iconSize) / 2})`}>
      <Component width={iconSize} height={iconSize} />
    </g>
  ) : (
    <></>
  );
};

const renderPopoverDecorator = (
  element: Node,
  quadrant: TopologyQuadrant,
  icon: React.ReactNode,
  content: React.ReactFragment,
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
      headerContent="Hosts"
      bodyContent={content}
    >
      <Decorator x={x} y={y} radius={DEFAULT_DECORATOR_RADIUS} icon={icon} />
    </Popover>
  );
};

/*
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
*/

const renderDecorators = (element: Node): React.ReactNode => {
  const data = element.getData() as NodeData;

  let hosts: string[] = [];
  data.hasVS?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));
  data.isGateway?.ingressInfo?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));
  data.isGateway?.egressInfo?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));
  data.isGateway?.gatewayAPIInfo?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));

  let htmlHosts: React.ReactFragment = <></>;
  if (hosts.length !== 0) {
    let hostsToShow = hosts;
    if (hostsToShow.length > config.graph.maxHosts) {
      hostsToShow = hosts.slice(0, config.graph.maxHosts);
      hostsToShow.push(
        hosts.length - config.graph.maxHosts === 1
          ? '1 more host...'
          : `${hosts.length - config.graph.maxHosts} more hosts...`
      );
    }
    htmlHosts = (
      <div className={hostsList}>
        {hostsToShow.map(h => (
          <div>{h}</div>
        ))}
      </div>
    );
  }

  return (
    <>
      {hosts.length > 0 &&
        renderPopoverDecorator(
          element,
          TopologyQuadrant.upperLeft,
          <GlobeIcon />, //TODO, replace with actual attachment
          htmlHosts
        )}
    </>
  );
};

const StyleNode: React.FC<StyleNodeProps> = ({ element, ...rest }) => {
  // const { t } = useTranslation('plugin__netobserv-plugin');
  const data = element.getData() as NodeData;
  //TODO: check if we can have intelligent pin on view change
  //const [isPinned, setPinned] = React.useState<boolean>(data.isPinned);
  // const [isFiltered, setFiltered] = React.useState<boolean>(data.isFiltered === true);
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
  // if (isPinned) {
  //   //check if position has changed = controller reset element and is not pinned anymore
  //   if (element.getPosition() !== data.point) {
  //     setPinned(false);
  //   } else {
  //     updatedRest.dragNodeRef = undefined;
  //   }
  // }
  return (
    <DefaultNode
      element={element}
      {...updatedRest}
      {...passedData}
      // dragging={dragging}
      //regrouping={isPinned ? false : regrouping}
      // showLabel={detailsLevel === ScaleDetailsLevel.high && showLabel}
      showStatusBackground={detailsLevel === ScaleDetailsLevel.low}
      //showStatusDecorator={detailsLevel === ScaleDetailsLevel.high && passedData.showStatusDecorator}
      attachments={detailsLevel === ScaleDetailsLevel.high && renderDecorators(element)}
    >
      {renderIcon(element)}
    </DefaultNode>
  );
};

export default observer(StyleNode);
