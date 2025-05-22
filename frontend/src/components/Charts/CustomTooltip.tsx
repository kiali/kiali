import * as React from 'react';
import { ChartTooltipProps } from '@patternfly/react-charts/victory';
import { ChartTooltip, ChartLabel, ChartPoint, ChartCursorFlyout } from '@patternfly/react-charts/victory';
import { VCDataPoint } from 'types/VictoryChartInfo';

const dy = 15;
const headSize = 2 * dy;
const yMargin = 8;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const canvasContext: any = document.createElement('canvas').getContext('2d');
// TODO: safe way to get this programmatically?
canvasContext.font = '14px overpass';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomLabel = (props: any & { head?: string; text: string[]; textWidth: number }) => {
  const x = props.x - 11 - props.textWidth / 2;
  const textsWithHead = props.head ? [props.head, ' '].concat(props.text) : props.text;
  const headSize = props.head ? 2 * dy : 0;
  const startY = yMargin + props.y - (textsWithHead.length * dy) / 2 + headSize;

  return (
    <>
      {props.activePoints &&
        props.activePoints
          .filter(pt => pt.color && !pt.hideLabel)
          .map((pt, idx) => {
            const symbol = pt.symbol || 'square';
            return (
              <ChartPoint
                key={'item-' + idx}
                style={{ fill: pt.color, type: symbol }}
                x={x}
                y={startY + dy * idx}
                symbol={symbol}
                size={5.5}
              />
            );
          })}
      <ChartLabel {...props} text={textsWithHead} />
    </>
  );
};

const getHeader = (activePoints?: VCDataPoint[]): string | undefined => {
  if (activePoints && activePoints.length > 0) {
    const x = activePoints[0].x;
    if (typeof x === 'object') {
      // Assume date
      return x.toLocaleStringWithConditionalDate();
    }
  }
  return undefined;
};

export type HookedTooltipProps<T> = ChartTooltipProps & {
  activePoints?: (VCDataPoint & T)[];
  onOpen?: (items: VCDataPoint[]) => void;
  onClose?: () => void;
};

export class HookedChartTooltip<T> extends React.Component<HookedTooltipProps<T>> {
  componentDidMount() {
    if (this.props.onOpen && this.props.activePoints) {
      this.props.onOpen(this.props.activePoints);
    }
  }

  componentWillUnmount() {
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  render() {
    return <ChartTooltip {...this.props} />;
  }
}

type Props = HookedTooltipProps<{}> & {
  showTime?: boolean;
};

type State = {
  texts: string[];
  head?: string;
  textWidth: number;
  width: number;
  height: number;
};

export class CustomTooltip extends React.Component<Props, State> {
  static getDerivedStateFromProps(props: Props): State {
    const head = props.showTime ? getHeader(props.activePoints) : undefined;
    const texts: string[] =
      props.text && Array.isArray(props.text) ? (props.text as string[]) : !props.text ? [] : [props.text as string];
    let height = texts.length * dy + 2 * yMargin;
    if (head) {
      height += headSize;
    }
    const textWidth = Math.max(...texts.map(t => canvasContext.measureText(t).width));
    const width = 50 + (head ? Math.max(textWidth, canvasContext.measureText(head).width) : textWidth);
    return {
      head: head,
      texts: texts,
      textWidth: textWidth,
      width: width,
      height: height
    };
  }

  constructor(p: Props) {
    super(p);
    this.state = CustomTooltip.getDerivedStateFromProps(p);
  }

  render() {
    return (
      <HookedChartTooltip
        {...this.props}
        text={this.state.texts}
        flyoutWidth={this.state.width}
        flyoutHeight={this.state.height}
        flyoutComponent={<ChartCursorFlyout style={{ stroke: 'none', fillOpacity: 0.6 }} />}
        labelComponent={<CustomLabel head={this.state.head} textWidth={this.state.textWidth} />}
      />
    );
  }
}
