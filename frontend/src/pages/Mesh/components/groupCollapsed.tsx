import * as React from 'react';
import { observer } from 'mobx-react';
import { css } from '@patternfly/react-styles';
import styles from '@patternfly/react-topology/dist/js/css/topology-components';
import ExpandIcon from '@patternfly/react-icons/dist/esm/icons/expand-alt-icon';
import {
  CollapsibleGroupProps,
  LabelBadge,
  Ellipse,
  NodeLabel,
  useDragNode,
  WithContextMenuProps,
  WithDndDropProps,
  WithDragNodeProps,
  WithSelectionProps,
  BadgeLocation,
  LabelPosition,
  Node,
  createSvgIdUrl,
  useCombineRefs,
  useHover,
  useSize,
  Layer,
  GROUPS_LAYER
} from '@patternfly/react-topology';
import { NODE_SHADOW_FILTER_ID_HOVER } from '@patternfly/react-topology/dist/esm/components/nodes/NodeShadows';

// This is a copy of PFT DefaultGroupCollapsed (v4.68.3), then modified.  I don't see a better way to really
// do this because DefaultGroupCollapsed doesn't really seem itself extensible and to add certain behavior you have
// to reimplement the rendered element.  This supports the following customizations:
// *No* active customizations, possibly may need:
//   [Node] element.data.isHighlighted?: boolean         // adds highlight effects based on hover
//   [Node] element.data.isUnhighlighted?: boolean       // adds unhighlight effects based on hover
//
// If we could contribute all of these customizations for PFT then we may be able to avoid this "BaseGroupCollapsed" component and
// just use "DefaultGroupCollapsed" directly.

type BaseGroupCollapsedProps = {
  children?: React.ReactNode;
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
  labelPosition?: LabelPosition; // Defaults to bottom
  truncateLength?: number; // Defaults to 13
  labelIconClass?: string; // Icon to show in label
  labelIcon?: string;
  labelIconPadding?: number;
  badge?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  badgeBorderColor?: string;
  badgeClassName?: string;
  badgeLocation?: BadgeLocation;
} & Partial<CollapsibleGroupProps & WithDragNodeProps & WithSelectionProps & WithDndDropProps & WithContextMenuProps>;

const BaseGroupCollapsedComponent: React.FunctionComponent<BaseGroupCollapsedProps> = ({
  className,
  element,
  collapsible,
  selected,
  onSelect,
  children,
  hover,
  label,
  secondaryLabel,
  showLabel = true,
  truncateLength,
  collapsedWidth,
  collapsedHeight,
  getCollapsedShape,
  onCollapseChange,
  collapsedShadowOffset = 8,
  dndDropRef,
  dragNodeRef,
  canDrop,
  dropTarget,
  onContextMenu,
  contextMenuOpen,
  dragging,
  labelPosition,
  badge,
  badgeColor,
  badgeTextColor,
  badgeBorderColor,
  badgeClassName,
  badgeLocation,
  labelIconClass,
  labelIcon,
  labelIconPadding
}) => {
  const [hovered, hoverRef] = useHover();
  const [labelHover, labelHoverRef] = useHover();
  const dragLabelRef = useDragNode()[1];
  const [shapeSize, shapeRef] = useSize([collapsedWidth, collapsedHeight]);
  const refs = useCombineRefs<SVGPathElement>(hoverRef as any, dragNodeRef as any, shapeRef as any);
  const isHover = hover !== undefined ? hover : hovered;
  const childCount = element.getAllNodeChildren().length;
  const [badgeSize, badgeRef] = useSize([childCount]);

  const groupClassName = css(
    styles.topologyGroup,
    className,
    canDrop && 'pf-m-highlight',
    canDrop && dropTarget && 'pf-m-drop-target',
    dragging && 'pf-m-dragging',
    selected && 'pf-m-selected'
  );

  const ShapeComponent = getCollapsedShape ? getCollapsedShape(element) : Ellipse;
  const filter = isHover || dragging || dropTarget ? createSvgIdUrl(NODE_SHADOW_FILTER_ID_HOVER) : undefined;

  return (
    <g ref={labelHoverRef as any} onContextMenu={onContextMenu} onClick={onSelect} className={groupClassName}>
      <Layer id={GROUPS_LAYER}>
        <g ref={refs} onClick={onSelect}>
          {ShapeComponent && (
            <>
              <g transform={`translate(${collapsedShadowOffset * 2}, 0)`}>
                <ShapeComponent
                  className={css(styles.topologyNodeBackground, 'pf-m-disabled')}
                  element={element}
                  width={collapsedWidth as number}
                  height={collapsedHeight as number}
                />
              </g>
              <g transform={`translate(${collapsedShadowOffset}, 0)`}>
                <ShapeComponent
                  className={css(styles.topologyNodeBackground, 'pf-m-disabled')}
                  element={element}
                  width={collapsedWidth as number}
                  height={collapsedHeight as number}
                />
              </g>
              <ShapeComponent
                className={css(styles.topologyNodeBackground)}
                key={isHover || dragging || dropTarget ? 'shape-background-hover' : 'shape-background'} // update key to force remount and filter update
                element={element}
                width={collapsedWidth as number}
                height={collapsedHeight as number}
                dndDropRef={dndDropRef}
                filter={filter}
              />
            </>
          )}
        </g>
      </Layer>
      {shapeSize && childCount && (
        <LabelBadge
          className={styles.topologyGroupCollapsedBadge}
          ref={badgeRef as any}
          x={shapeSize.width - 8}
          y={(shapeSize.width - (badgeSize?.height ?? 0)) / 2}
          badge={`${childCount}`}
          badgeColor={badgeColor}
          badgeTextColor={badgeTextColor}
          badgeBorderColor={badgeBorderColor}
        />
      )}
      {showLabel && (
        <NodeLabel
          className={styles.topologyGroupLabel}
          x={labelPosition === LabelPosition.right ? (collapsedWidth as number) + 8 : (collapsedWidth as number) / 2}
          y={labelPosition === LabelPosition.right ? (collapsedHeight as number) / 2 : (collapsedHeight as number) + 6}
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
          actionIcon={collapsible ? <ExpandIcon /> : undefined}
          onActionIconClick={() => onCollapseChange!(element, false)}
        >
          {label || element.getLabel()}
        </NodeLabel>
      )}
      {children}
    </g>
  );
};

export const BaseGroupCollapsed = observer(BaseGroupCollapsedComponent);
