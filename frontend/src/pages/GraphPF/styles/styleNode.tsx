import {
  DefaultNode,
  getShapeComponent,
  Node,
  NodeShape,
  observer,
  ScaleDetailsLevel,
  useHover,
  WithSelectionProps
} from '@patternfly/react-topology';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import * as React from 'react';
import { KeyIcon, TopologyIcon } from '@patternfly/react-icons';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { keyframes } from 'typestyle';

// This is the registered Node component override that utilizes our customized Node.tsx component.

type StyleNodeProps = {
  element: Node;
} & WithSelectionProps;

const renderIcon = (element: Node): React.ReactNode => {
  let Component: React.ComponentClass<React.ComponentProps<any>> | undefined;
  const data = element.getData();
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

  // this blurb taken from PFT demo StyleNode.tsx, not sure if it's required
  // vv
  const { width, height } = element.getDimensions();
  const shape = element.getNodeShape();
  const iconSize =
    (shape === NodeShape.trapezoid ? width : Math.min(width, height)) - (shape === NodeShape.stadium ? 5 : 20) * 2;
  // ^^

  return Component ? (
    <g transform={`translate(${(width - iconSize) / 2}, ${(height - iconSize) / 2})`}>
      <Component width={iconSize} height={iconSize} />
    </g>
  ) : (
    <></>
  );
};

const StyleNodeComponent: React.FC<StyleNodeProps> = ({ element, ...rest }) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();
  const [hover, hoverRef] = useHover();
  const ShapeComponent = getShapeComponent(element);

  const ColorFind = PFColors.Gold400;
  const ColorFocus = PFColors.Blue400;
  const ColorSpan = PFColors.Purple200;
  const OverlayOpacity = 0.3;
  const OverlayWidth = 40;

  const traceOverlayStyle = kialiStyle({
    strokeWidth: OverlayWidth,
    stroke: ColorSpan,
    strokeOpacity: OverlayOpacity
  });

  const findOverlayStyle = kialiStyle({
    strokeWidth: OverlayWidth,
    stroke: ColorFind,
    strokeOpacity: OverlayOpacity
  });

  const focusAnimation = keyframes({
    '0%': { strokeWidth: OverlayWidth },
    '100%': { strokeWidth: 0 }
  });

  const focusOverlayStyle = kialiStyle({
    stroke: ColorFocus,
    strokeOpacity: OverlayOpacity,
    animationDuration: '1s',
    animationName: focusAnimation,
    animationIterationCount: 3
  });

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
    if (detailsLevel !== ScaleDetailsLevel.high) {
      newData.tag = undefined;
    }
    Object.keys(newData).forEach(key => {
      if (newData[key] === undefined) {
        delete newData[key];
      }
    });
    return newData;
  }, [data, detailsLevel]);

  if (data.isFocused) {
    element.setData({ ...data, isFocused: false });
  }

  const { width, height } = element.getDimensions();

  if (data.isFind) {
  } else if (data.isFocused) {
  }

  return (
    <g style={{ opacity: opacity }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} ref={hoverRef as any}>
      {data.hasSpans && (
        <ShapeComponent className={traceOverlayStyle} width={width} height={height} element={element} />
      )}
      {data.isFind && <ShapeComponent className={findOverlayStyle} width={width} height={height} element={element} />}
      {data.isFocused && (
        <ShapeComponent className={focusOverlayStyle} width={width} height={height} element={element} />
      )}
      <DefaultNode
        element={element}
        {...rest}
        {...passedData}
        attachments={hover || detailsLevel === ScaleDetailsLevel.high ? data.attachments : undefined}
        scaleLabel={hover && detailsLevel !== ScaleDetailsLevel.high}
        // scaleNode={hover && detailsLevel === ScaleDetailsLevel.low}
        showLabel={hover || detailsLevel === ScaleDetailsLevel.high}
        showStatusBackground={detailsLevel === ScaleDetailsLevel.low}
      >
        {(hover || detailsLevel !== ScaleDetailsLevel.low) && renderIcon(element)}
      </DefaultNode>
    </g>
  );
};

export const StyleNode = observer(StyleNodeComponent);
