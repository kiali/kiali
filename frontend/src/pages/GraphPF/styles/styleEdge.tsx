import { DefaultEdge, Edge, observer, ScaleDetailsLevel, WithSelectionProps } from '@patternfly/react-topology';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import { PFColors } from 'components/Pf/PfColors';
import * as React from 'react';
import { style } from 'typestyle';

// This is our styled edge component registered in stylesComponentFactory.tsx.  It is responsible for adding our custom customizations that get passed down to DefaultEdge.  The current customizations:
//   data.pathStyle?: React.CSSProperties // additional CSS stylings for the edge/path (not the endpoint).
//   data.isFind?: boolean                // adds graph-find overlay
//   data.isUnhighlighted?: boolean       // adds unhighlight effects
//   data.hasSpans?: Span[]               // adds trace overlay
//   add showTag prop and show scaled tag on hover (when showTag is false)

const ColorFind = PFColors.Gold400;
const ColorSpan = PFColors.Purple200;
const OverlayOpacity = 0.3;
const OverlayWidth = 30;

type StyleEdgeProps = {
  element: Edge;
} & WithSelectionProps;

const StyleEdgeComponent: React.FC<StyleEdgeProps> = ({ element, ...rest }) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();

  let classes: string[] = [];

  // Change edge color according to the pathStyle
  const edgeClass = style({
    $nest: {
      '.pf-topology__edge__link': data.pathStyle
    }
  });
  classes.push(edgeClass);

  // Change connector color according to the pathStyle
  const connectorClass = style({
    $nest: {
      '.pf-topology-connector-arrow': {
        stroke: data.pathStyle.stroke,
        fill: data.pathStyle.stroke
      }
    }
  });
  classes.push(connectorClass);

  // If has spans, add the span overlay
  if (data.hasSpans) {
    const spansClass = style({
      $nest: {
        '.pf-topology__edge__background': {
          strokeWidth: OverlayWidth,
          stroke: ColorSpan,
          strokeOpacity: OverlayOpacity
        }
      }
    });
    classes.push(spansClass);
    // If isHighlighted, add the highlight overlay
  } else if (data.isFind) {
    const findClass = style({
      $nest: {
        '.pf-topology__edge__background': {
          strokeWidth: OverlayWidth,
          stroke: ColorFind,
          strokeOpacity: OverlayOpacity
        }
      }
    });
    classes.push(findClass);
  }

  // Set animation duration velocity
  if (data.animationDuration) {
    const animationClass = style({
      $nest: {
        '.pf-topology__edge__link': {
          animationDuration: `${data.animationDuration}s`
        }
      }
    });
    classes.push(animationClass);
  }

  // Set the path style when unhighlighted
  if (data.isUnhighlighted) {
    const unhighlightedClass = style({
      $nest: {
        '.pf-topology__edge_link': {
          opacity: 0.1
        }
      }
    });
    classes.push(unhighlightedClass);
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

  return <DefaultEdge className={classes?.join(' ')} element={element} {...rest} {...passedData} />;
};

export const StyleEdge = observer(StyleEdgeComponent);
