import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { pluralize } from '@patternfly/react-core';
import { ChartCursorFlyout, ChartLabelProps } from '@patternfly/react-charts';
import { style } from 'typestyle';

import { KialiAppState } from 'store/Store';
import {
  averageSpanDuration,
  buildQueriesFromSpans,
  allStatsIntervals,
  reduceMetricsStats,
  StatsMatrix
} from 'utils/tracing/TraceStats';
import { KialiAppAction } from 'actions/KialiAppAction';
import { MetricsStatsQuery } from 'types/MetricsOptions';
import MetricsStatsThunkActions from 'actions/MetricsStatsThunkActions';
import { JaegerLineInfo } from './JaegerScatter';
import { JaegerTrace } from 'types/JaegerInfo';
import { renderTraceHeatMap } from './JaegerResults/StatsComparison';
import { PFColors } from 'components/Pf/PfColors';
import { HookedChartTooltip, HookedTooltipProps } from 'components/Charts/CustomTooltip';
import { formatDuration } from 'utils/tracing/TracingHelper';

const flyoutWidth = 280;
const flyoutHeight = 130;
const flyoutMargin = 10;
const innerWidth = flyoutWidth - 2 * flyoutMargin;
const innerHeight = flyoutHeight - 2 * flyoutMargin;

const tooltipStyle = style({
  color: PFColors.Black100,
  width: innerWidth,
  height: innerHeight
});

const titleStyle = style({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
});

const contentStyle = style({ width: '100%', height: '100%' });
const leftStyle = style({ width: '35%', height: '100%', float: 'left' });

type LabelProps = ChartLabelProps & {
  trace: JaegerTrace;
  loadMetricsStats: (queries: MetricsStatsQuery[]) => void;
  statsMatrix?: StatsMatrix;
  isStatsMatrixComplete: boolean;
};

class TraceLabel extends React.Component<LabelProps> {
  componentDidMount() {
    const queries = buildQueriesFromSpans(this.props.trace.spans);
    this.props.loadMetricsStats(queries);
  }

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
            <div className={leftStyle}>
              {hasStats ? renderTraceHeatMap(this.props.statsMatrix!, allStatsIntervals, true) : 'n/a'}
            </div>
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
  const { matrix, isComplete } = reduceMetricsStats(props.trace, allStatsIntervals, state.metricsStats.data);
  return {
    statsMatrix: matrix,
    isStatsMatrixComplete: isComplete
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  loadMetricsStats: (queries: MetricsStatsQuery[]) => dispatch(MetricsStatsThunkActions.load(queries))
});

const TraceLabelContainer = connect(mapStateToProps, mapDispatchToProps)(TraceLabel);

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
          constrainToVisibleArea={true}
        />
      );
    }
    return null;
  }
}
