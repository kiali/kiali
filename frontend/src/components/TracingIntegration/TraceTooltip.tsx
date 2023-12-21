import * as React from 'react';
import { connect } from 'react-redux';
import { pluralize } from '@patternfly/react-core';
import { ChartCursorFlyout, ChartLabelProps } from '@patternfly/react-charts';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiAppState } from 'store/Store';
import { averageSpanDuration, reduceMetricsStats } from 'utils/tracing/TraceStats';
import { JaegerLineInfo } from './TracingScatter';
import { JaegerTrace } from 'types/TracingInfo';
import { renderTraceHeatMap } from './TracingResults/StatsComparison';
import { PFColors } from 'components/Pf/PfColors';
import { HookedChartTooltip, HookedTooltipProps } from 'components/Charts/CustomTooltip';
import { formatDuration } from 'utils/tracing/TracingHelper';
import { TEMPO } from '../../types/Tracing';
import { MetricsStats } from '../../types/Metrics';
import { KialiDispatch } from '../../types/Redux';
import { TracingThunkActions } from '../../actions/TracingThunkActions';

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
  selectedTrace?: JaegerTrace;
  metricsStats?: Map<string, MetricsStats>;
  setTraceId: (cluster?: string, traceId?: string) => void;
};

const textStyle: React.CSSProperties = {
  fontStyle: 'italic',
  fontSize: 'x-small'
};

class TraceLabel extends React.Component<LabelProps> {
  private traceUpdated = true;

  componentDidUpdate(prevProps) {
    if (!this.props.trace.loaded) {
      this.props.trace.loaded = true;
      this.props.setTraceId('', this.props.trace.traceID);
    }
    if (prevProps.selectedTrace && prevProps.selectedTrace !== this.props.selectedTrace) {
      this.traceUpdated = true;
      this.forceUpdate();
    } else {
      if (this.traceUpdated && this.props.selectedTrace) {
        this.traceUpdated = false;
      }
    }
  }

  render() {
    const trace = this.props.selectedTrace && this.traceUpdated ? this.props.selectedTrace : this.props.trace;
    const { matrix } = this.props.metricsStats
      ? reduceMetricsStats(trace, this.props.metricsStats, true)
      : { matrix: undefined };

    const left = flyoutMargin + (this.props.x || 0) - flyoutWidth / 2;
    const top = flyoutMargin + (this.props.y || 0) - flyoutHeight / 2;
    const avgSpanDuration = averageSpanDuration(trace);
    const hasStats = matrix && matrix.some(sub => sub.some(v => v !== undefined));
    return (
      <foreignObject width={innerWidth} height={innerHeight} x={left} y={top}>
        <div className={tooltipStyle}>
          <div className={titleStyle}>{trace.traceName || $t('MissingRootSpan', '(Missing root span)')}</div>
          <br />
          <div className={contentStyle}>
            <div className={leftStyle}>
              {hasStats ? (
                renderTraceHeatMap(matrix!, true)
              ) : this.props.provider === TEMPO ? (
                <div style={textStyle}>({$t('LoadingTraceDetails', 'Loading trace details')})</div>
              ) : (
                'n/a'
              )}
            </div>
            <div>
              {formatDuration(trace.duration)}
              <br />
              {`${pluralize(trace.spans.length, 'span')}, avg=${
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
  return {
    metricsStats: state.metricsStats.data,
    trace: props.trace,
    provider: state.tracingState.info?.provider,
    selectedTrace: state.tracingState.selectedTrace
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  setTraceId: (cluster?: string, traceId?: string) => dispatch(TracingThunkActions.setTraceId(cluster, traceId))
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
        />
      );
    }
    return null;
  }
}
