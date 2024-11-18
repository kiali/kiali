import { DefaultEdge, Edge, Layer, observer, ScaleDetailsLevel, WithSelectionProps } from '@patternfly/react-topology';
import { useDetailsLevel } from '@patternfly/react-topology';
import { PFColors } from 'components/Pf/PfColors';
//import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { classes, keyframes } from 'typestyle';
import React, { useRef, useEffect } from 'react';

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

const CanvasComponent = () => {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (containerRef.current) {
      const canvas = document.createElement('canvas');
      containerRef.current.append(canvas);

      const context = canvas.getContext('2d');
      context!.fillStyle = 'green';
      context!.fillRect(10, 10, 100, 100);
    }
  }, [containerRef]);

  return <div ref={containerRef} />;
};

const StyleEdgeComponent: React.FC<StyleEdgeProps> = ({ element, ...rest }) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();

  let cssClasses: string[] = [];

  const onMouseEnter = (): void => {
    data.onHover(element, true);
  };

  const onMouseLeave = (): void => {
    data.onHover(element, false);
  };

  const edgeClass = kialiStyle({
    $nest: {
      // node status color on edges
      '& .pf-topology__edge__link': data.pathStyle,
      '& .pf-topology-connector-arrow': {
        stroke: data.pathStyle.stroke,
        fill: data.pathStyle.stroke
      },

      // active color for selected edges
      '&.pf-m-selected': {
        $nest: {
          '& .pf-topology__edge__link': {
            stroke: PFColors.Active
          },
          '& .pf-topology-connector-arrow': {
            stroke: PFColors.Active,
            fill: PFColors.Active,
            strokeWidth: 1
          }
        }
      },

      // maintain the selection background on hover (only for selected edges)
      '&.pf-m-selected.pf-m-hover': {
        $nest: {
          '.pf-topology__edge__background': {
            stroke: 'var(--pf-topology__edge--m-selected--background--Stroke)'
          }
        }
      },

      // pointer cursor on hover
      '&.pf-m-hover': {
        cursor: 'pointer',
        $nest: {
          '.pf-topology__edge__background': {
            cursor: 'pointer'
          }
        }
      }
    }
  });

  cssClasses.push(edgeClass);

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

  const startPoint = element.getStartPoint();
  const endPoint = element.getEndPoint();

  const moveX = endPoint.x - startPoint.x;
  const moveY = endPoint.y - startPoint.y;

  const move = keyframes({
    from: { transform: 'translateX(0)' },
    to: { transform: `translateX(${moveX}px) translateY(${moveY}px)` }
  });

  const circleStyle = kialiStyle({
    fill: 'white',
    stroke: 'blue',
    animationName: move,
    animationDuration: '1s',
    animationFillMode: 'forwards',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite'
  });

  return (
    <g style={{ opacity: opacity }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <DefaultEdge className={classes(...cssClasses)} element={element} tagClass={tagClass} {...rest} {...passedData} />
      <circle cx={startPoint.x} cy={startPoint.y} r="5" className={circleStyle} style={{ animationDelay: '0.5s' }} />
      <circle cx={startPoint.x} cy={startPoint.y} r="5" className={circleStyle} style={{ animationDelay: '1s' }} />
    </g>
  const hasAnimation = true;
  return (
    <>
      {hasAnimation && (
        <Layer id={hasAnimation ? 'animation' : undefined}>
          <g style={{ opacity: opacity }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            <CanvasComponent />
            <DefaultEdge
              className={classes(...cssClasses)}
              element={element}
              tagClass={tagClass}
              {...rest}
              {...passedData}
              tag="foo"
            />
          </g>
        </Layer>
      )}
      <g style={{ opacity: opacity }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <DefaultEdge
          className={classes(...cssClasses)}
          element={element}
          tagClass={tagClass}
          {...rest}
          {...passedData}
        />
      </g>
    </>
  );
};

export const StyleEdge = observer(StyleEdgeComponent);
