// A heatmap implementation tailored for Kiali design
// (inspired from https://github.com/arunghosh/react-grid-heatmap (MIT), credits to @arunghosh)

import { PfColors } from 'components/Pf/PfColors';
import React from 'react';
import { style } from 'typestyle';

// rgb in [0,255] bounds
export type Color = { r: number; g: number; b: number };
export type ColorMap = Color[];

type Props = {
  xLabels: string[];
  yLabels: string[];
  data: (number | undefined)[][];
  colorMap: ColorMap;
  dataRange: { from: number; to: number };
  colorUndefined: string;
  valueFormat: (v: number) => string;
  tooltip: (x: number, y: number, v: number) => string;
  compactMode?: boolean;
};

const cellHeight = '2rem';
const compactCellHeight = '1rem';

const rowStyle = style({
  display: 'flex',
  flexDirection: 'row'
});

const columnStyle = style({
  display: 'flex',
  flexDirection: 'column'
});

const yLabelStyle = style({
  boxSizing: 'border-box',
  padding: '0 0.2rem',
  lineHeight: cellHeight,
  whiteSpace: 'nowrap'
});

const xLabelRowStyle = style({
  display: 'flex',
  textAlign: 'center'
});

const xLabelStyle = style({
  padding: '0.2rem 0',
  boxSizing: 'border-box',
  overflow: 'hidden',
  flexShrink: 1,
  flexBasis: cellHeight,
  width: cellHeight
});

const largeCellStyle = style({
  textAlign: 'center',
  overflow: 'hidden',
  boxSizing: 'border-box',
  flexBasis: cellHeight,
  flexShrink: 0,
  height: cellHeight,
  lineHeight: cellHeight,
  fontSize: '.7rem',
  borderRadius: 3,
  margin: 1
});

const compactCellStyle = style({
  textAlign: 'center',
  overflow: 'hidden',
  boxSizing: 'border-box',
  flexBasis: compactCellHeight,
  flexShrink: 0,
  height: compactCellHeight,
  lineHeight: compactCellHeight,
  borderRadius: 3,
  margin: 1
});

export class HeatMap extends React.Component<Props> {
  static HealthColorMap: ColorMap = [
    { r: 62, g: 134, b: 53 }, // Success (#3e8635)
    { r: 146, g: 212, b: 0 }, // PF Success 100 (#92d400)
    { r: 228, g: 245, b: 188 }, // PF Light green 100 (#e4f5bc)
    { r: 240, g: 171, b: 0 }, // PF Warning 100 (#f0ab00)
    { r: 201, g: 25, b: 11 } // PF Danger 100 (#c9190b)
  ];

  private getCellColors = (value: number) => {
    const { from, to } = this.props.dataRange;
    const clamped = Math.max(from, Math.min(to, value));
    const ratio = (clamped - from) / (to - from); // e.g. 0.8 | 0 | 1
    const colorRatio = ratio * (this.props.colorMap.length - 1); // e.g. (length is 3) 1.6 | 0 | 2
    const colorLow = this.props.colorMap[Math.floor(colorRatio)]; // e.g. m[1] | m[0] | m[2]
    const colorHigh = this.props.colorMap[Math.ceil(colorRatio)]; // e.g. m[2] | m[0] | m[2]
    const remains = colorRatio - Math.floor(colorRatio); // e.g. 0.6 | 0 | 0
    const r = Math.floor((colorHigh.r - colorLow.r) * remains + colorLow.r);
    const g = Math.floor((colorHigh.g - colorLow.g) * remains + colorLow.g);
    const b = Math.floor((colorHigh.b - colorLow.b) * remains + colorLow.b);
    const brightness = 0.21 * r + 0.72 * g + 0.07 * b; // https://www.johndcook.com/blog/2009/08/24/algorithms-convert-color-grayscale/
    const textColor = brightness > 128 ? PfColors.Black1000 : PfColors.Black100;
    return {
      color: textColor,
      backgroundColor: `rgb(${r},${g},${b})`
    };
  };

  render() {
    const cellStyle = this.props.compactMode ? compactCellStyle : largeCellStyle;
    return (
      <div className={rowStyle}>
        <div className={columnStyle} style={{ marginTop: cellHeight }}>
          {!this.props.compactMode &&
            this.props.yLabels.map(label => (
              <div key={label} className={yLabelStyle}>
                {label}
              </div>
            ))}
        </div>
        <div className={columnStyle}>
          <div className={xLabelRowStyle}>
            {!this.props.compactMode &&
              this.props.xLabels.map(label => (
                <div key={label} className={xLabelStyle}>
                  {label}
                </div>
              ))}
          </div>
          <div className={columnStyle}>
            {this.props.yLabels.map((_, y) => (
              <div key={`heatmap_${y}`} className={rowStyle}>
                {this.props.xLabels.map((_, x) => {
                  const value = this.props.data[x][y];
                  if (value) {
                    const style = this.getCellColors(value);
                    return (
                      <div
                        key={`heatmap_${x}-${y}`}
                        className={cellStyle}
                        style={style}
                        title={this.props.tooltip(x, y, value)}
                      >
                        {!this.props.compactMode && this.props.valueFormat(value)}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`heatmap_${x}-${y}`}
                      className={cellStyle}
                      style={{ backgroundColor: this.props.colorUndefined }}
                    >
                      {!this.props.compactMode && 'n/a'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}
