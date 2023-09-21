import * as React from 'react';
import * as d3 from 'd3';
import { observer } from 'mobx-react';
import { polygonHull } from 'd3-polygon';
import * as _ from 'lodash';
import { css } from '@patternfly/react-styles';
import styles from '@patternfly/react-topology/dist/js/css/topology-components';
import CollapseIcon from '@patternfly/react-icons/dist/esm/icons/compress-alt-icon';
import {
  CollapsibleGroupProps,
  NodeLabel,
  useDragNode,
  WithContextMenuProps,
  WithDndDropProps,
  WithDragNodeProps,
  WithSelectionProps,
  BadgeLocation,
  Node,
  useCombineRefs,
  useHover,
  Layer,
  GROUPS_LAYER,
  useSvgAnchor,
  isGraph,
  maxPadding,
  NodeStyle,
  PointTuple,
  NodeShape,
  hullPath
} from '@patternfly/react-topology';
import { PFColors } from 'components/Pf/PfColors';
import { keyframes } from 'typestyle';

// This is a copy of PFT DefaultGroupExpanded (v4.68.3), then modified.  I don't see a better way to really
// do this because DefaultGroupExpanded doesn't really seem itself extensible and to add certain behavior you have
// to reimplement the rendered element.  This supports the following customizations:
//   [Group] isFocused?: boolean             // adds focus overlay
//   [Group] isUnhighlighted?: boolean       // adds unhighlight effects based on hover
//   [NodeLabel] isHover                          // adds "raise" logic to bring label to the top
//   show scaled label on hover (when showLabel is false)
//
// If we could contribute all of these customizations for PFT then we may be able to avoid this "BaseGroupExpanded" component and
// just use "DefaultGroupExpanded" directly.

type BaseGroupExpandedProps = {
  className?: string;
  element: Node;
  droppable?: boolean;
  canDrop?: boolean;
  dropTarget?: boolean;
  dragging?: boolean;
  hover?: boolean;
  label?: string; // Defaults to element.getLabel()
  secondaryLabel?: string;
  showLabel?: boolean; // Defaults to true
  truncateLength?: number; // Defaults to 13
  badge?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  badgeBorderColor?: string;
  badgeClassName?: string;
  badgeLocation?: BadgeLocation;
  labelIconClass?: string; // Icon to show in label
  labelIcon?: string;
  labelIconPadding?: number;
  // Customizations
  isFocused?: boolean;
  isUnhighlighted?: boolean;
} & Partial<CollapsibleGroupProps & WithDragNodeProps & WithSelectionProps & WithDndDropProps & WithContextMenuProps>;

type PointWithSize = [number, number, number];

// Return the point whose Y is the largest value.
// If multiple points are found, compute the center X between them
// export for testing only
export function computeLabelLocation(points: PointWithSize[]): PointWithSize {
  let lowPoints: PointWithSize[];
  const threshold = 5;

  _.forEach(points, p => {
    const delta = !lowPoints ? Infinity : Math.round(p[1]) - Math.round(lowPoints[0][1]);
    if (delta > threshold) {
      lowPoints = [p];
    } else if (Math.abs(delta) <= threshold) {
      lowPoints.push(p);
    }
  });
  return [
    (_.minBy(lowPoints!, p => p[0])![0] + _.maxBy(lowPoints!, p => p[0])![0]) / 2,
    lowPoints![0][1],
    // use the max size value
    _.maxBy(lowPoints!, p => p[2])![2]
  ];
}

const BaseGroupExpandedComponent: React.FunctionComponent<BaseGroupExpandedProps> = ({
  className,
  element,
  collapsible,
  selected,
  onSelect,
  hover,
  label,
  secondaryLabel,
  showLabel = true,
  truncateLength,
  dndDropRef,
  droppable,
  canDrop,
  dropTarget,
  onContextMenu,
  contextMenuOpen,
  dragging,
  dragNodeRef,
  badge,
  badgeColor,
  badgeTextColor,
  badgeBorderColor,
  badgeClassName,
  badgeLocation,
  labelIconClass,
  labelIcon,
  labelIconPadding,
  onCollapseChange,
  // Customizations
  isFocused,
  isUnhighlighted
}) => {
  const [hovered, hoverRef] = useHover();
  const [labelHover, labelHoverRef] = useHover();
  const dragLabelRef = useDragNode()[1];
  const refs = useCombineRefs<SVGPathElement>(hoverRef as any, dragNodeRef as any);
  const isHover = hover !== undefined ? hover : hovered;
  const anchorRef = useSvgAnchor();
  const outlineRef = useCombineRefs(dndDropRef as any, anchorRef);
  const labelLocation = React.useRef<PointWithSize>();
  const pathRef = React.useRef<string>();

  let parent = element.getParent();
  let altGroup = false;
  while (!isGraph(parent)) {
    altGroup = !altGroup;
    parent = parent.getParent();
  }

  React.useEffect(() => {
    if (!element.isVisible()) {
      return;
    }

    if (isHover) {
      if (!!element.getData()?.onHover) {
        element.getData()?.onHover(element, true);
      }
    } else {
      if (!!element.getData()?.onHover) {
        element.getData()?.onHover(element, false);
      }
    }
  }, [element, isHover]);

  // cast to number and coerce
  const padding = maxPadding(element.getStyle<NodeStyle>().padding ?? 17);
  const hullPadding = (point: PointWithSize | PointTuple) => (point[2] || 0) + padding;

  if (!droppable || !pathRef.current || !labelLocation.current) {
    const children = element.getNodes().filter(c => c.isVisible());
    if (children.length === 0) {
      return null;
    }
    const points: (PointWithSize | PointTuple)[] = [];
    _.forEach(children, c => {
      if (c.getNodeShape() === NodeShape.circle) {
        const bounds = c.getBounds();
        const { width, height } = bounds;
        const { x, y } = bounds.getCenter();
        const radius = Math.max(width, height) / 2;
        points.push([x, y, radius] as PointWithSize);
      } else {
        // add all 4 corners
        const { width, height, x, y } = c.getBounds();
        points.push([x, y, 0] as PointWithSize);
        points.push([x + width, y, 0] as PointWithSize);
        points.push([x, y + height, 0] as PointWithSize);
        points.push([x + width, y + height, 0] as PointWithSize);
      }
    });
    const hullPoints: (PointWithSize | PointTuple)[] | null =
      points.length > 2 ? polygonHull(points as PointTuple[]) : (points as PointTuple[]);
    if (!hullPoints) {
      return null;
    }

    // change the box only when not dragging
    pathRef.current = hullPath(hullPoints as PointTuple[], hullPadding);

    // Compute the location of the group label.
    labelLocation.current = computeLabelLocation(hullPoints as PointWithSize[]);
  }

  const UnhighlightOpacity = 0.1;

  const groupClassName = css(
    styles.topologyGroup,
    className,
    altGroup && 'pf-m-alt-group',
    canDrop && 'pf-m-highlight',
    dragging && 'pf-m-dragging',
    selected && 'pf-m-selected'
  );
  const innerGroupClassName = css(
    styles.topologyGroup,
    className,
    altGroup && 'pf-m-alt-group',
    canDrop && 'pf-m-highlight',
    dragging && 'pf-m-dragging',
    selected && 'pf-m-selected',
    (isHover || labelHover) && 'pf-m-hover',
    canDrop && dropTarget && 'pf-m-drop-target'
  );

  // This raises the node above other nodes to ensure that when hovered the user can see the node information, if it
  // was occluded.  Especially to handle for label overlap.  The approach is heavy-handed, and fragile, but I'm not
  // savvy enough to make it better. It basically searches works up to the node based on the css class name, and then
  // "knows" it needs to go one level higher to reach the proper grouping.
  const raise = e => {
    let target = e.target;
    try {
      while (d3.select(target).attr('class') !== 'pf-topology__group') {
        target = target.parentNode;
      }
      d3.select(target.parentNode).raise();
    } catch (err) {
      // ignore when this logic doesn't work and travels too far up the chain
    }
  };

  const scale = element.getGraph().getScale();
  const labelScale = isHover && !showLabel ? Math.max(1, 1 / scale) : 1;
  const labelPositionScale = isHover && !showLabel ? Math.min(1, scale) : 1;

  const ColorFocus = PFColors.Blue400;
  const OverlayOpacity = 0.3;
  const OverlayWidth = 40;

  const focusAnimation = keyframes({
    '0%': { strokeWidth: OverlayWidth },
    '100%': { strokeWidth: 0 }
  });

  return (
    <g
      ref={labelHoverRef as any}
      onContextMenu={onContextMenu}
      onClick={onSelect}
      className={groupClassName}
      style={!!isUnhighlighted ? { opacity: UnhighlightOpacity } : {}}
    >
      <Layer id={GROUPS_LAYER}>
        <g ref={refs} onContextMenu={onContextMenu} onClick={onSelect} className={innerGroupClassName}>
          {isFocused && (
            <path
              ref={outlineRef as any}
              className={styles.topologyGroupBackground}
              d={pathRef.current}
              style={{
                stroke: ColorFocus,
                strokeOpacity: OverlayOpacity,
                animationDuration: '1s',
                animationName: focusAnimation,
                animationIterationCount: 3
              }}
            />
          )}
          <path ref={outlineRef as any} className={styles.topologyGroupBackground} d={pathRef.current} />
        </g>
      </Layer>
      {(showLabel || isHover) && (
        <g transform={`scale(${isHover ? labelScale : 1})`} onMouseEnter={raise}>
          <NodeLabel
            className={styles.topologyGroupLabel}
            x={labelLocation.current[0] * labelPositionScale}
            y={(labelLocation.current[1] + hullPadding(labelLocation.current) + 24) * labelPositionScale}
            paddingX={8}
            paddingY={5}
            dragRef={dragNodeRef ? dragLabelRef : undefined}
            status={element.getNodeStatus()}
            secondaryLabel={secondaryLabel}
            truncateLength={truncateLength}
            badge={badge}
            badgeColor={badgeColor}
            badgeTextColor={badgeTextColor}
            badgeBorderColor={badgeBorderColor}
            badgeClassName={badgeClassName}
            badgeLocation={badgeLocation}
            labelIconClass={labelIconClass}
            labelIcon={labelIcon}
            labelIconPadding={labelIconPadding}
            onContextMenu={onContextMenu}
            contextMenuOpen={contextMenuOpen}
            hover={isHover || labelHover}
            actionIcon={collapsible ? <CollapseIcon /> : undefined}
            onActionIconClick={() => onCollapseChange!(element, true)}
          >
            {label || element.getLabel()}
          </NodeLabel>
        </g>
      )}
    </g>
  );
};

export const BaseGroupExpanded = observer(BaseGroupExpandedComponent);
