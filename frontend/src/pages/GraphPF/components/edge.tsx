import * as React from 'react';
import { css } from '@patternfly/react-styles';
import styles from '@patternfly/react-styles/css/components/Topology/topology-components';
import * as _ from 'lodash';
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
  observer,
  DefaultConnectorTerminal
} from '@patternfly/react-topology';
import DefaultConnectorTag from '@patternfly/react-topology/dist/esm/components/edges/DefaultConnectorTag';
import { getConnectorStartPoint } from '@patternfly/react-topology/dist/esm/components/edges/terminals/terminalUtils';
import { EdgeData } from '../GraphPFElems';
import { PFColors } from 'components/Pf/PfColors';
import { style } from 'typestyle';

// This is a copy of PFT DefaultEdge (v4.68.3), then modified.  I don't see a better way to really
// do this because DefaultEdge doesn't really seem itself extensible and to add certain behavior you have
// to reimplement the rendered element.  This supports the following customizations:
//   [Edge] element.data.pathStyle?: React.CSSProperties // additional CSS stylings for the edge/path (not the endpoint).
//   [Edge] element.data.isFind?: boolean                // adds graph-find overlay
//   [Edge] element.data.isHighlighted?: boolean         // adds highlight effects
//   [Edge] element.data.isUnhighlighted?: boolean       // adds unhighlight effects
//   [Edge] element.data.hasSpans?: Span[]               // adds trace overlay

type BaseEdgeProps = {
  children?: React.ReactNode;
  element: Edge;
  dragging?: boolean;
  className?: string;
  animationDuration?: number;
  startTerminalType?: EdgeTerminalType;
  startTerminalClass?: string;
  startTerminalStatus?: NodeStatus;
  startTerminalSize?: number;
  endTerminalType?: EdgeTerminalType;
  endTerminalClass?: string;
  endTerminalStatus?: NodeStatus;
  endTerminalSize?: number;
  tag?: string;
  tagClass?: string;
  tagStatus?: NodeStatus;
} & Partial<
  WithRemoveConnectorProps & WithSourceDragProps & WithTargetDragProps & WithSelectionProps & WithContextMenuProps
>;

const ColorFind = PFColors.Gold400;
const ColorSpan = PFColors.Purple200;
const OverlayOpacity = 0.3;
const OverlayWidth = 40;
//const OpacityUnhighlightLeast = 0.5;
//const OpacityUnhighlightMedium = 0.3;
//const OpacityUnhighlightMost = 0.1;
//const OpacityUnhighlightLabel = 0.3;

const BaseEdge: React.FunctionComponent<BaseEdgeProps> = ({
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
  startTerminalSize = 14,
  endTerminalType = EdgeTerminalType.directional,
  endTerminalClass,
  // endTerminalStatus,
  endTerminalSize = 14,
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

  React.useLayoutEffect(() => {
    if (hover && !dragging) {
      if (!!element.getData()?.onHover) {
        element.getData()?.onHover(element, true);
      }
      onShowRemoveConnector && onShowRemoveConnector();
    } else {
      if (!!element.getData()?.onHover) {
        element.getData()?.onHover(element, false);
      }
      onHideRemoveConnector && onHideRemoveConnector();
    }
  }, [element, hover, dragging, onShowRemoveConnector, onHideRemoveConnector]);

  const groupClassName = css(
    styles.topologyEdge,
    className,
    dragging && 'pf-m-dragging',
    hover && !dragging && 'pf-m-hover',
    selected && !dragging && 'pf-m-selected'
  );

  const startPoint = element.getStartPoint();
  const endPoint = element.getEndPoint();
  const edgeAnimationDuration = animationDuration ?? getEdgeAnimationDuration(element.getEdgeAnimationSpeed());
  const linkClassName = css(styles.topologyEdgeLink, getEdgeStyleClassModifier(element.getEdgeStyle()));

  const bendpoints = element.getBendpoints();
  const d = `M${startPoint.x} ${startPoint.y} ${bendpoints.map((b: Point) => `L${b.x} ${b.y} `).join('')}L${
    endPoint.x
  } ${endPoint.y}`;

  const data = element.getData() as EdgeData;
  const pathStyle: React.CSSProperties = data.pathStyle || {};
  const terminatorFill = style({
    fill: data.pathStyle?.stroke
  });
  const customEndTerminalClass = css(endTerminalClass, terminatorFill);

  const bgStartPoint =
    !startTerminalType || startTerminalType === EdgeTerminalType.none
      ? [startPoint.x, startPoint.y]
      : getConnectorStartPoint(_.head(bendpoints) || endPoint, startPoint, startTerminalSize);
  const bgEndPoint =
    !endTerminalType || endTerminalType === EdgeTerminalType.none
      ? [endPoint.x, endPoint.y]
      : getConnectorStartPoint(_.last(bendpoints) || startPoint, endPoint, endTerminalSize);
  const backgroundPath = `M${bgStartPoint[0]} ${bgStartPoint[1]} ${bendpoints
    .map((b: Point) => `L${b.x} ${b.y} `)
    .join('')}L${bgEndPoint[0]} ${bgEndPoint[1]}`;

  return (
    <Layer id={dragging || hover ? TOP_LAYER : undefined}>
      <g
        ref={hoverRef as any}
        data-test-id="edge-handler"
        className={groupClassName}
        style={data.isUnhighlighted ? { opacity: 0.1 } : {}}
        onClick={onSelect}
        onContextMenu={onContextMenu}
      >
        <path
          className={css(styles.topologyEdgeBackground)}
          d={backgroundPath}
          onMouseEnter={onShowRemoveConnector}
          onMouseLeave={onHideRemoveConnector}
        />
        <path
          className={linkClassName}
          d={d}
          style={{ animationDuration: `${edgeAnimationDuration}s`, ...pathStyle }}
        />
        {!!data.hasSpans && (
          <path d={d} style={{ strokeWidth: OverlayWidth, stroke: ColorSpan, strokeOpacity: OverlayOpacity }} />
        )}
        {!!data.isFind && (
          <path d={d} style={{ strokeWidth: OverlayWidth, stroke: ColorFind, strokeOpacity: OverlayOpacity }} />
        )}
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
          size={startTerminalSize}
          dragRef={sourceDragRef}
          terminalType={startTerminalType}
          status={startTerminalStatus}
          highlight={dragging || hover}
        />
        <DefaultConnectorTerminal
          className={customEndTerminalClass}
          isTarget
          dragRef={targetDragRef}
          edge={element}
          size={endTerminalSize}
          terminalType={endTerminalType}
          status={NodeStatus.default} // status={endTerminalStatus}
          highlight={dragging || hover}
        />
        {children}
      </g>
    </Layer>
  );
};

export default observer(BaseEdge);
