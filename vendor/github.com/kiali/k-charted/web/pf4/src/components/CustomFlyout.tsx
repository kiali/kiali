import * as React from 'react';
import { Flyout } from 'victory';

const squareSize = 10;

export const CustomFlyout = (props: any) => {
  const { width, center, datum } = props;
  const left = center.x - width / 2;
  const top = center.y - squareSize / 2;
  const extraWidth = squareSize + 5;
  return (
    <>
      <Flyout
        {...props}
        width={width + extraWidth}
      />
      <rect width={squareSize} height={squareSize} x={left} y={top} style={{ fill: datum.color }} />
    </>
  );
};
