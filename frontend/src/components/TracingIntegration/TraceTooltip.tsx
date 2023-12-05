import * as React from 'react';
import { connect } from 'react-redux';
import { pluralize } from '@patternfly/react-core';
import { ChartCursorFlyout, ChartLabelProps } from '@patternfly/react-charts';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiAppState } from 'store/Store';
import { averageSpanDuration, reduceMetricsStats, StatsMatrix } from 'utils/tracing/TraceStats';
import { JaegerLineInfo } from './TracingScatter';
import { JaegerTrace } from 'types/TracingInfo';
import { renderTraceHeatMap } from './TracingResults/StatsComparison';
import { PFColors } from 'components/Pf/PfColors';
import { HookedChartTooltip, HookedTooltipProps } from 'components/Charts/CustomTooltip';
import { formatDuration } from 'utils/tracing/TracingHelper';

const flyoutWidth = 280;
const flyoutHeight = 130;
const flyoutMargin = 10;
const innerWidth = flyoutWidth - 2 * flyoutMargin;
const innerHeight = flyoutHeight - 2 * flyoutMargin;

const tooltipStyle = kialiStyle({
  color: PFColors.ColorLight100,
  width: innerWidth,
  height: innerHeight
});

const titleStyle = kialiStyle({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
});

const contentStyle = kialiStyle({ width: '100%', height: '100%' });
const leftStyle = kialiStyle({ width: '35%', height: '100%', float: 'left' });

type LabelProps = ChartLabelProps & {
  isStatsMatrixComplete: boolean;
  provider?: string;
  trace: JaegerTrace;
  statsMatrix?: StatsMatrix;
};

class TraceLabel extends React.Component<LabelProps> {
  render() {
    const left = flyoutMargin + (this.props.x || 0) - flyoutWidth / 2;
    const top = flyoutMargin + (this.props.y || 0) - flyoutHeight / 2;
    const avgSpanDuration = averageSpanDuration(this.props.trace);
    const hasStats = this.props.statsMatrix && this.props.statsMatrix.some(sub => sub.some(v => v !== undefined));

    return (
      <foreignObject width={innerWidth} height={innerHeight} x={left} y={top}>
        <div className={tooltipStyle}>
          <div className={titleStyle}>{this.props.trace.traceName || '(Missing root span)'}</div>
          <br />
          <div className={contentStyle}>
            <div className={leftStyle}>{hasStats ? renderTraceHeatMap(this.props.statsMatrix!, true) : 'n/a'}</div>
            <div>
              {formatDuration(this.props.trace.duration)}
              <br />
              {`${pluralize(this.props.trace.spans.length, 'span')}, avg=${
                avgSpanDuration ? formatDuration(avgSpanDuration) : 'n/a'
              }`}
            </div>
          </div>
        </div>
      </foreignObject>
    );
  }
}

const mapStateToProps = (state: KialiAppState, props: any) => {
  const { matrix, isComplete } = reduceMetricsStats(props.trace, state.metricsStats.data, true);
  return {
    statsMatrix: matrix,
    isStatsMatrixComplete: isComplete
  };
};

const TraceLabelContainer = connect(mapStateToProps)(TraceLabel);

export class TraceTooltip extends React.Component<HookedTooltipProps<JaegerLineInfo>> {
  render() {
    if (this.props.activePoints && this.props.activePoints.length > 0) {
      const trace = this.props.activePoints[0].trace;
      return (
        <HookedChartTooltip
          {...this.props}
          flyoutWidth={flyoutWidth}
          flyoutHeight={flyoutHeight}
          flyoutComponent={<ChartCursorFlyout style={{ stroke: 'none', fillOpacity: 0.6 }} />}
          labelComponent={<TraceLabelContainer trace={trace} />}
        />
      );
    }
    return null;
  }
}
