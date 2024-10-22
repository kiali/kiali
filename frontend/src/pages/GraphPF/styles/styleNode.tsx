import {
  DefaultNode,
  getShapeComponent,
  Node,
  NodeShape,
  observer,
  ScaleDetailsLevel,
  ShapeProps,
  useHover,
  WithSelectionProps
} from '@patternfly/react-topology';
import { useDetailsLevel } from '@patternfly/react-topology';
import * as React from 'react';
import { KeyIcon, TopologyIcon } from '@patternfly/react-icons';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { Triangle } from '../elements/triangle';
import { Plate } from '../elements/plate';

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

  const { width, height } = element.getDimensions();
  const dim = Math.min(width, height);
  let iconX = dim * 0.27;
  let iconY = dim * 0.27;
  let iconDim = dim * 0.45;

  switch (element.getNodeShape()) {
    case NodeShape.rhombus:
      // will be a triangle, slightly reduce icon size and adjust position
      iconDim = dim * 0.4;
      iconX = dim * 0.28;
      iconY = dim * 0.43;
      break;
    default:
    // use defaults
  }

  return Component ? (
    <g transform={`translate(${iconX} , ${iconY})`}>
      <Component width={iconDim} height={iconDim} />
    </g>
  ) : (
    <></>
  );
};

const getNodeShape = (node: Node): React.FunctionComponent<ShapeProps> => {
  switch (node.getNodeShape()) {
    case NodeShape.rhombus:
      return Triangle;
    case NodeShape.trapezoid:
      return Plate;
    default:
      return getShapeComponent(node);
  }
};

const nodeStyle = kialiStyle({
  $nest: {
    '&.pf-m-hover': {
      cursor: 'pointer'
    },
    '&.pf-m-selected .pf-topology__node__background': {
      stroke: PFColors.Active,
      strokeWidth: 6
    }
  }
});

// Hide the kebab menu of Patternfly topology nodes
const labelStyle = kialiStyle({
  $nest: {
    '& text:not(.pf-m-secondary)': {
      transform: 'translateX(10px)'
    },
    '& .pf-topology__node__action-icon': {
      visibility: 'hidden'
    },
    '& text ~ .pf-topology__node__separator': {
      visibility: 'hidden'
    },
    '& .pf-topology__node__label__icon__background': {
      fill: 'var(--pf-v5-global--palette--purple-500)'
    }
  }
});

const StyleNodeComponent: React.FC<StyleNodeProps> = ({ element, ...rest }) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();
  const [hover, hoverRef] = useHover();
  const ShapeComponent = getNodeShape(element);

  const ColorFind = PFColors.Gold400;
  const ColorFocus = PFColors.Blue200;
  const ColorSpan = PFColors.Purple200;
  const OverlayOpacity = 0.3;
  const OverlayWidth = 40;

  const findOverlayStyle = kialiStyle({
    strokeWidth: OverlayWidth,
    stroke: ColorFind,
    strokeOpacity: OverlayOpacity
  });

  const focusOverlayStyle = kialiStyle({
    strokeWidth: OverlayWidth,
    stroke: ColorFocus
  });

  const traceOverlayStyle = kialiStyle({
    strokeWidth: OverlayWidth,
    stroke: ColorSpan,
    strokeOpacity: OverlayOpacity
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

  const { width, height } = element.getDimensions();

  return (
    <g style={{ opacity: opacity }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} ref={hoverRef as any}>
      {data.hasSpans && (
        <ShapeComponent className={traceOverlayStyle} width={width} height={height} element={element} />
      )}
      {data.isFind && <ShapeComponent className={findOverlayStyle} width={width} height={height} element={element} />}
      {data.isFocus && <ShapeComponent className={focusOverlayStyle} width={width} height={height} element={element} />}
      <DefaultNode
        className={nodeStyle}
        labelClassName={labelStyle}
        element={element}
        {...rest}
        {...passedData}
        attachments={hover || detailsLevel === ScaleDetailsLevel.high ? data.attachments : undefined}
        getCustomShape={getNodeShape}
        scaleLabel={hover && detailsLevel === ScaleDetailsLevel.high}
        scaleNode={hover && detailsLevel !== ScaleDetailsLevel.high}
        showLabel={hover || detailsLevel === ScaleDetailsLevel.high}
        showStatusBackground={detailsLevel !== ScaleDetailsLevel.high}
      >
        {(hover || detailsLevel !== ScaleDetailsLevel.low) && renderIcon(element)}
      </DefaultNode>
    </g>
  );
};

export const StyleNode = observer(StyleNodeComponent);
