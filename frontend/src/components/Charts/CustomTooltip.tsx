import * as React from 'react';
import { ChartTooltip, ChartTooltipProps, ChartLabel, ChartPoint } from '@patternfly/react-charts/victory';
import { VCDataPoint } from 'types/VictoryChartInfo';

const dy = 15;
const yMargin = 8;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const canvasContext: any = document.createElement('canvas').getContext('2d');
// TODO: safe way to get this programmatically?
canvasContext.font = '14px overpass';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomLabel = (props: any & { head?: string; text: string[]; textWidth: number }): React.ReactElement => {
  const x = props.x - 16 - props.textWidth / 2;
  const textsWithHead = props.head ? [props.head].concat(props.text) : props.text;
  const startY = yMargin + props.y - (textsWithHead.length * dy) / 2;

  return (
    <>
      {props.activePoints &&
        props.activePoints
          .filter(pt => pt.color && !pt.hideLabel)
          .map((pt, idx) => {
            const symbol = pt.symbol || 'square';
            return (
              <ChartPoint
                key={`item-${idx}`}
                style={{ fill: pt.color, type: symbol }}
                x={x}
                y={startY + (props.head ? dy : 0) + dy * idx}
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
    if (typeof x === 'object' && (x as any).toLocaleStringWithConditionalDate) {
      return (x as any).toLocaleStringWithConditionalDate();
    }
  }
  return undefined;
};

export type HookedTooltipProps<T> = ChartTooltipProps & {
  activePoints?: (VCDataPoint & T)[];
  onClose?: () => void;
  onOpen?: (items: VCDataPoint[]) => void;
};

export class HookedChartTooltip<T> extends React.Component<HookedTooltipProps<T>> {
  componentDidMount(): void {
    if (this.props.onOpen && this.props.activePoints) {
      this.props.onOpen(this.props.activePoints);
    }
  }

  componentWillUnmount(): void {
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  render(): React.ReactNode {
    return <ChartTooltip {...this.props} />;
  }
}

type Props = HookedTooltipProps<{}> & {
  showTime?: boolean;
};

type State = {
  head?: string;
  height: number;
  textWidth: number;
  texts: string[];
  width: number;
};

export class CustomTooltip extends React.Component<Props, State> {
  static getDerivedStateFromProps(props: Props): State {
    const head = props.showTime ? getHeader(props.activePoints) : undefined;
    const texts: string[] =
      props.text && Array.isArray(props.text) ? (props.text as string[]) : !props.text ? [] : [props.text as string];

    const totalLines = texts.length + (head ? 1 : 0);
    const height = totalLines * dy + 2 * yMargin;

    const textWidth = Math.max(...texts.map(t => canvasContext.measureText(t).width), 0);
    const headWidth = head ? canvasContext.measureText(head).width : 0;
    const width = 50 + Math.max(textWidth, headWidth);

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

  render(): React.ReactNode {
    return (
      <HookedChartTooltip
        {...this.props}
        text={this.state.texts}
        flyoutWidth={this.state.width}
        flyoutHeight={this.state.height}
        constrainToVisibleArea={true}
        labelComponent={<CustomLabel head={this.state.head} textWidth={this.state.textWidth} />}
      />
    );
  }
}
