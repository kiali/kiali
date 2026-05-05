import * as React from 'react';
import { connect } from 'react-redux';
import { pluralize, Spinner } from '@patternfly/react-core';
import { ChartLabelProps, ChartCursorFlyout } from '@patternfly/react-charts/victory';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiAppState } from 'store/Store';
import { averageSpanDuration, reduceMetricsStats, StatsMatrix } from 'utils/tracing/TraceStats';
import { JaegerLineInfo } from './TracingScatter';
import { JaegerTrace } from 'types/TracingInfo';
import { renderTraceHeatMap } from './TracingResults/StatsComparison';
import { PFColors } from 'components/Pf/PfColors';
import { HookedChartTooltip, HookedTooltipProps } from 'components/Charts/CustomTooltip';
import { formatDuration } from 'utils/tracing/TracingHelper';

const flyoutWidth = 300;
const flyoutHeight = 100;
const flyoutMargin = 5;
const innerWidth = flyoutWidth - 2 * flyoutMargin;
const innerHeight = flyoutHeight - 2 * flyoutMargin;

const tooltipStyle = kialiStyle({
  color: PFColors.ColorLight100,
  backgroundColor: 'transparent',
  borderRadius: '0.25rem',
  padding: '0.625rem',
  width: innerWidth,
  height: innerHeight,
  fontSize: '0.75rem',
  lineHeight: '1.4'
});

const titleStyle = kialiStyle({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontWeight: 'bold',
  marginBottom: '0.5rem'
});

const contentStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center'
});

const leftStyle = kialiStyle({
  width: '80px',
  marginRight: '0.75rem',
  flexShrink: 0
});

const rightStyle = kialiStyle({
  lineHeight: '1.6'
});

type LabelProps = ChartLabelProps & {
  isStatsMatrixComplete: boolean;
  provider?: string;
  statsMatrix?: StatsMatrix;
  trace: JaegerTrace;
};

export class TraceLabel extends React.Component<LabelProps> {
  render(): JSX.Element {
    const left = flyoutMargin + (this.props.x || 0) - flyoutWidth / 2;
    const top = flyoutMargin + (this.props.y || 0) - flyoutHeight / 2;
    const avgSpanDuration = averageSpanDuration(this.props.trace);
    const hasStats = this.props.statsMatrix && this.props.statsMatrix.some(sub => sub.some(v => v !== undefined));

    return (
      <foreignObject width={innerWidth} height={innerHeight} x={left} y={top}>
        <div className={tooltipStyle}>
          <div className={titleStyle}>{this.props.trace.traceName || '(Missing root span)'}</div>
          <div className={contentStyle}>
            <div className={leftStyle}>
              {hasStats ? (
                renderTraceHeatMap(this.props.statsMatrix!, true)
              ) : this.props.isStatsMatrixComplete ? (
                'n/a'
              ) : (
                <Spinner size="sm" />
              )}
            </div>
            <div className={rightStyle}>
              <div>{formatDuration(this.props.trace.duration)}</div>
              <div>
                {`${pluralize(this.props.trace.spans.length, 'span')}, avg=${
                  avgSpanDuration ? formatDuration(avgSpanDuration) : 'n/a'
                }`}
              </div>
            </div>
          </div>
        </div>
      </foreignObject>
    );
  }
}

const mapStateToProps = (
  state: KialiAppState,
  props: any
): { isStatsMatrixComplete: boolean; statsMatrix: StatsMatrix } => {
  const { matrix, isComplete } = reduceMetricsStats(props.trace, state.metricsStats.data, true);
  return {
    statsMatrix: matrix,
    isStatsMatrixComplete: isComplete
  };
};

const TraceLabelContainer = connect(mapStateToProps)(TraceLabel);

type FlyoutOrientation = 'top' | 'bottom' | 'left' | 'right';
type FlyoutOrientationProps = Pick<ChartLabelProps, 'x' | 'y' | 'width'>;

export const computeFlyoutOrientation = (props: FlyoutOrientationProps): FlyoutOrientation => {
  const x = typeof props.x === 'number' ? props.x : 0;
  const y = typeof props.y === 'number' ? props.y : 0;
  const width = typeof props.width === 'number' ? props.width : 0;

  const horizontalMargin = flyoutWidth / 2 + flyoutMargin;
  const verticalMargin = flyoutHeight / 2 + flyoutMargin;

  if (x <= horizontalMargin) {
    return 'right';
  }
  if (width > 0 && x >= width - horizontalMargin) {
    return 'left';
  }
  if (y <= verticalMargin) {
    return 'bottom';
  }
  return 'top';
};

export class TraceTooltip extends React.Component<HookedTooltipProps<JaegerLineInfo>> {
  // Victory passes callback args that are broader than ChartLabelProps.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getOrientation = (props: any): FlyoutOrientation => computeFlyoutOrientation(props);

  render(): JSX.Element | null {
    if (this.props.activePoints && this.props.activePoints.length > 0) {
      const trace = this.props.activePoints[0].trace;
      return (
        <HookedChartTooltip
          {...this.props}
          constrainToVisibleArea={false}
          flyoutWidth={flyoutWidth}
          flyoutHeight={flyoutHeight}
          orientation={this.getOrientation}
          flyoutComponent={<ChartCursorFlyout style={{ stroke: 'none', fillOpacity: 0.6, pointerEvents: 'none' }} />}
          labelComponent={<TraceLabelContainer trace={trace} />}
        />
      );
    }
    return null;
  }
}
