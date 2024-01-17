import { DefaultEdge, Edge, observer, ScaleDetailsLevel, WithSelectionProps } from '@patternfly/react-topology';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import { PFColors } from 'components/Pf/PfColors';
import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { classes } from 'typestyle';

// This is our styled edge component registered in stylesComponentFactory.tsx.  It is responsible for adding customizations that then get passed down to DefaultEdge.  The current customizations:
//   data.pathStyle?: React.CSSProperties // additional CSS stylings for the edge/path (not the endpoint).
//   data.isFind?: boolean                // adds graph-find overlay
//   data.isUnhighlighted?: boolean       // adds unhighlight effects
//   data.hasSpans?: Span[]               // adds trace overlay
//   add showTag prop and show scaled tag on hover (when showTag is false)
//   support [lock] icons on edge tags

const ColorFind = PFColors.Gold400;
const ColorSpan = PFColors.Purple200;
const OverlayOpacity = 0.3;
const OverlayWidth = 30;

type StyleEdgeProps = {
  element: Edge;
} & WithSelectionProps;

const tagClass = kialiStyle({
  fontFamily: 'Verdana,Arial,Helvetica,sans-serif,pficon'
});

const StyleEdgeComponent: React.FC<StyleEdgeProps> = ({ element, ...rest }) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();

  let cssClasses: string[] = [];

  const onMouseEnter = () => {
    data.onHover(element, true);
  };

  const onMouseLeave = () => {
    data.onHover(element, false);
  };

  // Change edge color according to the pathStyle
  const edgeClass = kialiStyle({
    $nest: {
      '& .pf-topology__edge__link': data.pathStyle
    }
  });
  cssClasses.push(edgeClass);

  const edgeHoverClass = kialiStyle({
    $nest: {
      '& .pf-topology__edge.pf-m-hover': {
        $nest: {
          '& .pf-topology__edge__link, & .pf-topology-connector-arrow': data.pathStyle
        }
      }
    }
  });
  cssClasses.push(edgeHoverClass);

  // Change connector color according to the pathStyle
  const connectorClass = kialiStyle({
    $nest: {
      '& .pf-topology-connector-arrow': {
        stroke: data.pathStyle.stroke,
        fill: data.pathStyle.stroke
      }
    }
  });
  cssClasses.push(connectorClass);

  const edgeConnectorArrowHoverStyles = kialiStyle({
    $nest: {
      '& .pf-topology__edge.pf-m-hover': {
        $nest: {
          '& .pf-topology-connector-arrow': {
            stroke: data.pathStyle.stroke,
            fill: data.pathStyle.stroke
          }
        }
      }
    }
  });
  cssClasses.push(edgeConnectorArrowHoverStyles);

  // If has spans, add the span overlay
  if (data.hasSpans) {
    const spansClass = kialiStyle({
      $nest: {
        '& .pf-topology__edge__background': {
          strokeWidth: OverlayWidth,
          stroke: ColorSpan,
          strokeOpacity: OverlayOpacity
        }
      }
    });
    cssClasses.push(spansClass);
    // If isHighlighted, add the highlight overlay
  } else if (data.isFind) {
    const findClass = kialiStyle({
      $nest: {
        '& .pf-topology__edge__background': {
          strokeWidth: OverlayWidth,
          stroke: ColorFind,
          strokeOpacity: OverlayOpacity
        }
      }
    });
    cssClasses.push(findClass);
  }

  // Set animation duration velocity
  if (data.animationDuration) {
    const animationClass = kialiStyle({
      $nest: {
        '& .pf-topology__edge__link': {
          animationDuration: `${data.animationDuration}s`
        }
      }
    });
    cssClasses.push(animationClass);
  }

  // Set the path style when unhighlighted (opacity)
  let opacity = 1;
  if (data.isUnhighlighted) {
    opacity = 0.1;
  }

  const passedData = React.useMemo(() => {
    const newData = { ...data };
    if (detailsLevel !== ScaleDetailsLevel.high) {
      newData.showTag = false;
    }
    Object.keys(newData).forEach(key => {
      if (newData[key] === undefined) {
        delete newData[key];
      }
    });
    return newData;
  }, [data, detailsLevel]);

  return (
    <g style={{ opacity: opacity }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <DefaultEdge className={classes(...cssClasses)} element={element} tagClass={tagClass} {...rest} {...passedData} />
    </g>
  );
};

export const StyleEdge = observer(StyleEdgeComponent);
