import * as React from 'react';
import { css } from '@patternfly/react-styles';
import styles from '@patternfly/react-styles/css/components/Topology/topology-components';
import {
  Edge,
  EdgeTerminalType,
  NodeStatus,
  WithRemoveConnectorProps,
  WithSourceDragProps,
  WithTargetDragProps,
  WithSelectionProps,
  WithContextMenuProps,
  useHover,
  getEdgeAnimationDuration,
  getEdgeStyleClassModifier,
  Point,
  Layer,
  TOP_LAYER,
  DefaultConnectorTerminal,
  observer
} from '@patternfly/react-topology';
import DefaultConnectorTag from '@patternfly/react-topology/dist/esm/components/edges/DefaultConnectorTag';

type BaseEdgeProps = {
  element: Edge;
  dragging?: boolean;
  className?: string;
  animationDuration?: number;
  startTerminalType?: EdgeTerminalType;
  startTerminalClass?: string;
  startTerminalStatus?: NodeStatus;
  endTerminalType?: EdgeTerminalType;
  endTerminalClass?: string;
  endTerminalStatus?: NodeStatus;
  shadowed?: boolean;
  highlighted?: boolean;
  tag?: string;
  tagClass?: string;
  tagStatus?: NodeStatus;
} & WithRemoveConnectorProps &
  WithSourceDragProps &
  WithTargetDragProps &
  WithSelectionProps &
  Partial<WithContextMenuProps>;

// BaseEdge: slightly modified from @patternfly/react-topology/src/components/edges/DefaultEdge.tsx
// to support shadow / hover behaviors

const BaseEdge: React.FC<BaseEdgeProps> = ({
  element,
  dragging,
  sourceDragRef,
  targetDragRef,
  animationDuration,
  onShowRemoveConnector,
  onHideRemoveConnector,
  startTerminalType = EdgeTerminalType.none,
  startTerminalClass,
  startTerminalStatus,
  endTerminalType = EdgeTerminalType.directional,
  endTerminalClass,
  endTerminalStatus,
  shadowed,
  highlighted,
  tag,
  tagClass,
  tagStatus,
  children,
  className,
  selected,
  onSelect,
  onContextMenu
}) => {
  const [hover, hoverRef] = useHover();
  const startPoint = element.getStartPoint();
  const endPoint = element.getEndPoint();

  React.useLayoutEffect(() => {
    if (hover && !dragging) {
      onShowRemoveConnector && onShowRemoveConnector();
    } else {
      onHideRemoveConnector && onHideRemoveConnector();
    }
    //element.getController().fireEvent(HOVER_EVENT, {
    //  ...element.getData(),
    //  id: element.getId(),
    //  isHovered: hover
    //});
  }, [hover, dragging, onShowRemoveConnector, onHideRemoveConnector, element]);

  const groupClassName = css(
    styles.topologyEdge,
    className,
    hover && 'pf-m-hover',
    dragging && 'pf-m-dragging',
    selected && 'pf-m-selected',
    'topology',
    shadowed && 'shadowed',
    highlighted && 'edge-highlighted'
  );

  const edgeAnimationDuration = animationDuration ?? getEdgeAnimationDuration(element.getEdgeAnimationSpeed());
  const linkClassName = css(styles.topologyEdgeLink, getEdgeStyleClassModifier(element.getEdgeStyle()));

  const bendpoints = element.getBendpoints();

  const d = `M${startPoint.x} ${startPoint.y} ${bendpoints.map((b: Point) => `L${b.x} ${b.y} `).join('')}L${
    endPoint.x
  } ${endPoint.y}`;

  return (
    <Layer id={dragging || hover || highlighted ? TOP_LAYER : undefined}>
      <g
        ref={hoverRef as React.LegacyRef<SVGGElement> | undefined}
        data-test="edge-handler"
        className={groupClassName}
        onClick={onSelect}
        onContextMenu={onContextMenu}
      >
        <path
          strokeWidth={10}
          stroke="transparent"
          d={d}
          fill="none"
          onMouseEnter={onShowRemoveConnector}
          onMouseLeave={onHideRemoveConnector}
        />
        <path className={linkClassName} d={d} style={{ animationDuration: `${edgeAnimationDuration}s` }} />
        {tag && (
          <DefaultConnectorTag
            className={tagClass}
            startPoint={element.getStartPoint()}
            endPoint={element.getEndPoint()}
            tag={tag}
            status={tagStatus}
          />
        )}
        <DefaultConnectorTerminal
          className={startTerminalClass}
          isTarget={false}
          edge={element}
          dragRef={sourceDragRef}
          terminalType={startTerminalType}
          status={startTerminalStatus}
          highlight={dragging || hover || highlighted}
        />
        <DefaultConnectorTerminal
          className={endTerminalClass}
          isTarget
          dragRef={targetDragRef}
          edge={element}
          terminalType={endTerminalType}
          status={endTerminalStatus}
          highlight={dragging || hover || highlighted}
        />
        {children}
      </g>
    </Layer>
  );
};

export default observer(BaseEdge);
