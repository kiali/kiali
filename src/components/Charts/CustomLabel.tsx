import * as React from 'react';
import { VictoryLabel } from 'victory';

const squareSize = 10;
const dy = 15;

export const CustomLabel = (props: any & { colors: string[] }) => {
  const colors: string[] = [];
  const texts: string[] = [];
  props.text.forEach(t => {
    const parts = t.split('@');
    if (parts.length === 2) {
      colors.push(props.colors[+parts[0]]);
      texts.push(parts[1]);
    } else {
      colors.push('');
      texts.push(t);
    }
  });
  const x = props.x - 10 - 4 * Math.max(...texts.map(t => t.length));
  const startY = 3 + props.y - (texts.length * dy) / 2;
  return (
    <>
      {colors.map((color, idx) => {
        if (color !== '') {
          return <rect width={squareSize} height={squareSize} x={x} y={startY + dy * idx} style={{ fill: color }} />;
        }
        return null;
      })}
      <VictoryLabel {...props} text={texts} textAnchor="start" />
    </>
  );
};
