import * as React from 'react';
import { Flyout } from 'victory';

const squareSize = 10;

export const CustomFlyout = (props: any) => {
  const { x, width, center, datum } = props;
  const left = center.x - width / 2;
  const top = center.y - squareSize / 2;
  const extraWidth = squareSize + 5;
  return (
    <>
      <Flyout
        {...props}
        width={width + extraWidth}
        x={x - extraWidth}
        center={{ x: center.x - extraWidth / 2, y: center.y }}
        style={{ ...props.style, fillOpacity: 0.6 }}
      />
      <rect width={squareSize} height={squareSize} x={left} y={top} style={{ fill: datum.color }} />
    </>
  );
};
