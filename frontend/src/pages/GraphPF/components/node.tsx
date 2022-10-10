import * as React from 'react';
import { css } from '@patternfly/react-styles';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import CheckCircleIcon from '@patternfly/react-icons/dist/esm/icons/check-circle-icon';
import ExclamationCircleIcon from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import ExclamationTriangleIcon from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import styles from '@patternfly/react-styles/css/components/Topology/topology-components';
import {
  TopologyQuadrant,
  NodeStatus,
  LabelPosition,
  BadgeLocation,
  GraphElement,
  ShapeProps,
  WithSelectionProps,
  WithDragNodeProps,
  WithDndDragProps,
  WithDndDropProps,
  WithCreateConnectorProps,
  WithContextMenuProps,
  useHover,
  DEFAULT_DECORATOR_RADIUS,
  getDefaultShapeDecoratorCenter,
  Decorator,
  getShapeComponent,
  StatusModifier,
  createSvgIdUrl,
  Node,
  NodeShadows,
  NodeLabel,
  observer,
  Layer,
  TOP_LAYER
} from '@patternfly/react-topology';
import {
  NODE_SHADOW_FILTER_ID_DANGER,
  NODE_SHADOW_FILTER_ID_HOVER
} from '@patternfly/react-topology/dist/esm/components/nodes/NodeShadows';

const StatusQuadrant = TopologyQuadrant.upperLeft;

const getStatusIcon = (status: NodeStatus) => {
  switch (status) {
    case NodeStatus.danger:
      return <ExclamationCircleIcon className="pf-m-danger" />;
    case NodeStatus.warning:
      return <ExclamationTriangleIcon className="pf-m-warning" />;
    case NodeStatus.success:
      return <CheckCircleIcon className="pf-m-success" />;
    default:
      return null;
  }
};

type BaseNodeProps = {
  children?: React.ReactNode;
  className?: string;
  element: Node;
  droppable?: boolean;
  hover?: boolean;
  canDrop?: boolean;
  dragging?: boolean;
  edgeDragging?: boolean;
  dropTarget?: boolean;
  shadowed?: boolean;
  highlighted?: boolean;
  label?: string; // Defaults to element.getLabel()
  secondaryLabel?: string;
  showLabel?: boolean; // Defaults to true
  labelPosition?: LabelPosition; // Defaults to element.getLabelPosition()
  truncateLength?: number; // Defaults to 13
  labelIconClass?: string; // Icon to show in label
  labelIcon?: React.ReactNode;
  labelIconPadding?: number;
  badge?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  badgeBorderColor?: string;
  badgeClassName?: string;
  badgeLocation?: BadgeLocation;
  attachments?: React.ReactNode; // ie. decorators
  showStatusBackground?: boolean;
  showStatusDecorator?: boolean;
  statusDecoratorTooltip?: React.ReactNode;
  onStatusDecoratorClick?: (event: React.MouseEvent<SVGGElement, MouseEvent>, element: GraphElement) => void;
  getCustomShape?: (node: Node) => React.FC<ShapeProps>;
  getShapeDecoratorCenter?: (quadrant: TopologyQuadrant, node: Node) => { x: number; y: number };
} & Partial<
  WithSelectionProps &
    WithDragNodeProps &
    WithDndDragProps &
    WithDndDropProps &
    WithCreateConnectorProps &
    WithContextMenuProps
>;

// BaseNode: slightly modified from @patternfly/react-topology/src/components/nodes/DefaultNode.tsx
// to support shadow / hover behaviors

const BaseNode: React.FC<BaseNodeProps> = ({
  className,
  element,
  selected,
  hover,
  showLabel = true,
  label,
  shadowed,
  highlighted,
  secondaryLabel,
  labelPosition,
  truncateLength,
  labelIconClass,
  labelIcon,
  labelIconPadding,
  showStatusBackground,
  showStatusDecorator = false,
  statusDecoratorTooltip,
  getCustomShape,
  getShapeDecoratorCenter,
  onStatusDecoratorClick,
  badge,
  badgeColor,
  badgeTextColor,
  badgeBorderColor,
  badgeClassName,
  badgeLocation,
  onSelect,
  children,
  attachments,
  dragNodeRef,
  dragging,
  edgeDragging,
  canDrop,
  dropTarget,
  dndDropRef,
  onHideCreateConnector,
  onShowCreateConnector,
  onContextMenu,
  contextMenuOpen
}) => {
  const [hovered, hoverRef] = useHover();
  const status = element.getNodeStatus();
  const { width, height } = element.getDimensions();
  const isHover = hovered || hover;

  const statusDecorator = React.useMemo(() => {
    if (!status || !showStatusDecorator) {
      return null;
    }

    const icon = getStatusIcon(status);
    if (!icon) {
      return null;
    }

    const { x, y } = getShapeDecoratorCenter
      ? getShapeDecoratorCenter(StatusQuadrant, element)
      : getDefaultShapeDecoratorCenter(StatusQuadrant, element);

    const decorator = (
      <Decorator
        x={x}
        y={y}
        radius={DEFAULT_DECORATOR_RADIUS}
        showBackground={false}
        onClick={e => onStatusDecoratorClick && onStatusDecoratorClick(e, element)}
        icon={<g className={css(styles.topologyNodeDecoratorStatus)}>{icon}</g>}
      />
    );

    if (statusDecoratorTooltip) {
      return (
        <Tooltip content={statusDecoratorTooltip} position={TooltipPosition.left}>
          {decorator}
        </Tooltip>
      );
    }

    return decorator;
  }, [showStatusDecorator, status, getShapeDecoratorCenter, element, statusDecoratorTooltip, onStatusDecoratorClick]);

  React.useEffect(() => {
    if (isHover) {
      onShowCreateConnector && onShowCreateConnector();
    } else {
      onHideCreateConnector && onHideCreateConnector();
    }
    //element.getController().fireEvent(HOVER_EVENT, {
    //  ...element.getData(),
    //  id: element.getId(),
    //  isHovered: isHover
    //});
  }, [isHover, onShowCreateConnector, onHideCreateConnector, element]);

  const ShapeComponent = (getCustomShape && getCustomShape(element)) || getShapeComponent(element);

  const groupClassName = css(
    styles.topologyNode,
    className,
    isHover && 'pf-m-hover',
    (dragging || edgeDragging) && 'pf-m-dragging',
    canDrop && 'pf-m-highlight',
    canDrop && dropTarget && 'pf-m-drop-target',
    selected && 'pf-m-selected',
    StatusModifier[status],
    'topology',
    shadowed && 'shadowed',
    highlighted && 'node-highlighted'
  );

  const backgroundClassName = css(
    styles.topologyNodeBackground,
    showStatusBackground && StatusModifier[status],
    showStatusBackground && selected && 'pf-m-selected'
  );

  let filter;
  if (status === 'danger') {
    filter = createSvgIdUrl(NODE_SHADOW_FILTER_ID_DANGER);
  } else if (isHover || dragging || edgeDragging || dropTarget) {
    filter = createSvgIdUrl(NODE_SHADOW_FILTER_ID_HOVER);
  }

  const nodeLabelPosition = labelPosition || element.getLabelPosition();

  return (
    <Layer id={dragging || isHover || highlighted ? TOP_LAYER : undefined}>
      <g ref={hoverRef as React.LegacyRef<SVGGElement> | undefined} className={groupClassName}>
        <NodeShadows />
        <g ref={dragNodeRef} onClick={onSelect} onContextMenu={onContextMenu}>
          {ShapeComponent && (
            <ShapeComponent
              className={backgroundClassName}
              element={element}
              width={width}
              height={height}
              dndDropRef={dndDropRef}
              filter={filter}
            />
          )}
          {showLabel && (label || element.getLabel()) && (
            <NodeLabel
              className={css(styles.topologyNodeLabel)}
              x={nodeLabelPosition === LabelPosition.right ? width + 8 : width / 2}
              y={nodeLabelPosition === LabelPosition.right ? height / 2 : height + 6}
              position={nodeLabelPosition}
              paddingX={8}
              paddingY={4}
              secondaryLabel={secondaryLabel}
              truncateLength={truncateLength}
              status={status}
              badge={badge}
              badgeColor={badgeColor}
              badgeTextColor={badgeTextColor}
              badgeBorderColor={badgeBorderColor}
              badgeClassName={badgeClassName}
              badgeLocation={badgeLocation}
              onContextMenu={onContextMenu as never}
              contextMenuOpen={contextMenuOpen ? true : false}
              hover={isHover}
              labelIconClass={labelIconClass}
              labelIcon={labelIcon}
              labelIconPadding={labelIconPadding}
            >
              {label || element.getLabel()}
            </NodeLabel>
          )}
          {children}
        </g>
        {statusDecorator}
        {isHover && attachments}
      </g>
    </Layer>
  );
};

export default observer(BaseNode);
