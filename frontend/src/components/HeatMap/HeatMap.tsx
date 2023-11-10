// A heatmap implementation tailored for Kiali design
// (inspired from https://github.com/arunghosh/react-grid-heatmap (MIT), credits to @arunghosh)

import { PFColors } from 'components/Pf/PfColors';
import React from 'react';
import { kialiStyle } from 'styles/StyleUtils';

// rgb in [0,255] bounds
export type Color = { r: number; g: number; b: number };
export type ColorMap = Color[];

type HeatMapProps = {
  colorMap: ColorMap;
  colorUndefined: string;
  data: (number | undefined)[][];
  dataRange: { from: number; to: number };
  displayMode?: 'compact' | 'normal' | 'large';
  tooltip: (x: number, y: number, v: number) => string;
  valueFormat: (v: number) => string;
  xLabels: (string | JSX.Element)[];
  yLabels: (string | JSX.Element)[];
};

const baseStyle = {
  alignItems: 'center',
  borderRadius: '3px',
  display: 'flex',
  fontSize: '0.75rem',
  justifyContent: 'center',
  overflow: 'hidden',
  textOverflow: 'clip'
};

const labelStyle = kialiStyle(baseStyle);

const cellStyle = kialiStyle({
  ...baseStyle,
  whiteSpace: 'nowrap'
});

export const healthColorMap: ColorMap = [
  { r: 62, g: 134, b: 53 }, // Success (#3e8635)
  { r: 146, g: 212, b: 0 }, // PF Success 100 (#92d400)
  { r: 228, g: 245, b: 188 }, // PF Light green 100 (#e4f5bc)
  { r: 240, g: 171, b: 0 }, // PF Warning 100 (#f0ab00)
  { r: 201, g: 25, b: 11 } // PF Danger 100 (#c9190b)
];

export const HeatMap: React.FC<HeatMapProps> = (props: HeatMapProps) => {
  const getGridStyle = (): React.CSSProperties => {
    if (props.displayMode === 'compact') {
      return {
        display: 'grid',
        gridTemplateColumns: `0 repeat(${props.xLabels.length}, 1fr)`,
        gridTemplateRows: `0 repeat(${props.yLabels.length}, 1rem)`,
        gridGap: 2,
        maxWidth: `${props.xLabels.length}rem`
      };
    }

    const cellHeight = '2rem';
    const cellWidth = props.displayMode === 'large' ? 3 : 2;

    return {
      display: 'grid',
      gridTemplateColumns: `${cellWidth}rem repeat(${props.xLabels.length}, 1fr)`,
      gridTemplateRows: new Array(props.yLabels.length + 1).fill(cellHeight).join(' '),
      gridGap: 2,
      maxWidth: `${cellWidth * (1 + props.xLabels.length)}rem`
    };
  };

  const getCellColors = (value: number): { color: PFColors; backgroundColor: string } => {
    const { from, to } = props.dataRange;
    const clamped = Math.max(from, Math.min(to, value));
    const ratio = (clamped - from) / (to - from); // e.g. 0.8 | 0 | 1
    const colorRatio = ratio * (props.colorMap.length - 1); // e.g. (length is 3) 1.6 | 0 | 2
    const colorLow = props.colorMap[Math.floor(colorRatio)]; // e.g. m[1] | m[0] | m[2]
    const colorHigh = props.colorMap[Math.ceil(colorRatio)]; // e.g. m[2] | m[0] | m[2]
    const remains = colorRatio - Math.floor(colorRatio); // e.g. 0.6 | 0 | 0
    const r = Math.floor((colorHigh.r - colorLow.r) * remains + colorLow.r);
    const g = Math.floor((colorHigh.g - colorLow.g) * remains + colorLow.g);
    const b = Math.floor((colorHigh.b - colorLow.b) * remains + colorLow.b);
    const brightness = 0.21 * r + 0.72 * g + 0.07 * b; // https://www.johndcook.com/blog/2009/08/24/algorithms-convert-color-grayscale/
    const textColor = brightness > 128 ? PFColors.Black1000 : PFColors.Black100;

    return {
      color: textColor,
      backgroundColor: `rgb(${r},${g},${b})`
    };
  };

  const isCompact = props.displayMode === 'compact';

  return (
    <div style={getGridStyle()}>
      <div></div>

      {props.xLabels.map((xLabel, x) => (
        <div key={`xlabel_${x}`} className={labelStyle}>
          {isCompact ? '' : xLabel}
        </div>
      ))}

      {props.yLabels.map((yLabel, y) => {
        return (
          <React.Fragment key={`ylabel_${y}`}>
            <div className={labelStyle}>{isCompact ? '' : yLabel}</div>

            {props.xLabels.map((_, x) => {
              const value = props.data[x][y];

              if (value) {
                const style = getCellColors(value);

                return (
                  <div key={`heatmap_${x}-${y}`} className={cellStyle} style={style} title={props.tooltip(x, y, value)}>
                    {!isCompact && props.valueFormat(value)}
                  </div>
                );
              }

              return (
                <div
                  key={`heatmap_${x}-${y}`}
                  className={cellStyle}
                  style={{ backgroundColor: props.colorUndefined, color: PFColors.Black1000 }}
                >
                  {!isCompact && 'n/a'}
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};
