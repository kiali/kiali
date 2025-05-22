import * as React from 'react';
import { connect } from 'react-redux';
import { KialiDispatch } from 'types/Redux';
import { ChartScatter } from '@patternfly/react-charts/victory';
import { EmptyState, EmptyStateVariant, EmptyStateBody } from '@patternfly/react-core';
import { TracingError, JaegerTrace } from '../../types/TracingInfo';
import { PFColors } from '../Pf/PfColors';
import { DurationInSeconds, evalTimeRange } from 'types/Common';
import { KialiAppState } from 'store/Store';
import { TracingThunkActions } from 'actions/TracingThunkActions';
import { LineInfo, makeLegend, VCDataPoint } from 'types/VictoryChartInfo';
import { ChartWithLegend } from 'components/Charts/ChartWithLegend';
import { durationSelector } from '../../store/Selectors';
import { TraceTooltip } from './TraceTooltip';
import { isErrorTag } from 'utils/tracing/TracingHelper';
import { averageSpanDuration, buildQueriesFromSpans } from 'utils/tracing/TraceStats';
import { kialiStyle } from 'styles/StyleUtils';
import { MetricsStatsQuery } from 'types/MetricsOptions';
import { MetricsStatsThunkActions } from 'actions/MetricsStatsThunkActions';
import { TEMPO } from '../../types/Tracing';
import { HistoryManager, URLParam } from '../../app/History';

type ReduxProps = {
  duration: DurationInSeconds;
  provider?: string;
  selectedTrace?: JaegerTrace;
};

type MapProps = {
  loadMetricsStats: (queries: MetricsStatsQuery[], isCompact: boolean) => Promise<any>;
  setTraceId: (cluster?: string, traceId?: string) => void;
};

interface TracingScatterProps {
  cluster?: string;
  duration: number;
  errorFetchTraces?: TracingError[];
  errorTraces?: boolean;
  loadMetricsStats: (queries: MetricsStatsQuery[], isCompact: boolean) => Promise<any>;
  provider?: string;
  selectedTrace?: JaegerTrace;
  setTraceId: (cluster?: string, traceId?: string) => void;
  showSpansAverage: boolean;
  traces: JaegerTrace[];
}

const ONE_MILLISECOND = 1000000;
const MINIMAL_SIZE = 2;
const MAXIMAL_SIZE = 30;

export type JaegerLineInfo = LineInfo & { trace: JaegerTrace };
type Datapoint = VCDataPoint & JaegerLineInfo;

const tracingChartStyle = kialiStyle({
  paddingTop: 15,
  paddingLeft: 25,
  paddingRight: 25,
  paddingBottom: 15
});

const emptyStyle = kialiStyle({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  // fix height + padding
  height: '350px',
  textAlign: 'center'
});

class TracingScatterComponent extends React.Component<TracingScatterProps> {
  isLoading = false;
  nextToLoad?: JaegerTrace = undefined;
  seletedTraceMatched: number | undefined;

  constructor(props: TracingScatterProps) {
    super(props);
    const traceId = HistoryManager.getParam(URLParam.TRACING_TRACE_ID);
    if (traceId) {
      this.props.setTraceId(this.props.cluster, traceId);
    }
  }

  renderFetchEmpty = (title, msg): JSX.Element => {
    return (
      <div className={emptyStyle}>
        <EmptyState headingLevel="h5" titleText={<>{title}</>} variant={EmptyStateVariant.sm} data-test="empty-traces">
          <EmptyStateBody>{msg}</EmptyStateBody>
        </EmptyState>
      </div>
    );
  };

  render(): JSX.Element {
    const tracesRaw: Datapoint[] = [];
    const tracesError: Datapoint[] = [];
    // Tracing uses Duration instead of TimeRange, evalTimeRange is a helper here
    const timeWindow = evalTimeRange({ rangeDuration: this.props.duration });

    let traces = this.props.traces;
    // Add currently selected trace in list in case it wasn't
    if (
      this.props.selectedTrace &&
      !traces.some(t => t.traceID === this.props.selectedTrace!.traceID) &&
      this.props.selectedTrace.startTime >= 1000 * timeWindow[0].getTime() &&
      this.props.selectedTrace.startTime <= 1000 * timeWindow[1].getTime()
    ) {
      traces.push(this.props.selectedTrace);
    }

    traces.forEach(trace => {
      const isSelected = this.props.selectedTrace && trace.traceID === this.props.selectedTrace.traceID;
      const traceError = trace.spans.filter(sp => sp.tags.some(isErrorTag)).length > 0;
      const value = this.props.showSpansAverage ? averageSpanDuration(trace) || 0 : trace.duration;

      let spansLength;
      if (this.props.provider === TEMPO) {
        // The query to get the spans in Tempo does not return all of them,
        // This is to avoid the resize of the circle
        if (this.props.selectedTrace?.traceID === trace.traceID) {
          spansLength = this.seletedTraceMatched;
          trace.matched = this.seletedTraceMatched;
        } else {
          spansLength = trace.matched;
        }
      } else {
        spansLength = trace.spans.length;
      }
      const size = Math.min(MAXIMAL_SIZE, spansLength + MINIMAL_SIZE);

      const traceItem = {
        x: new Date(trace.startTime / 1000),
        y: value / ONE_MILLISECOND,
        name: `${trace.traceName !== '' ? trace.traceName : '<trace-without-root-span>'} (${trace.traceID.slice(
          0,
          7
        )})`,
        color: isSelected ? PFColors.Blue500 : PFColors.Blue200,
        unit: 'seconds',
        trace: trace,
        size: size
      };
      if (traceError) {
        traceItem.color = isSelected ? PFColors.Red500 : PFColors.Red200;
        tracesError.push(traceItem);
      } else {
        tracesRaw.push(traceItem);
      }
    });
    const successTraces = {
      datapoints: tracesRaw,
      color: (({ datum }) => datum.color) as any,
      legendItem: makeLegend('Traces', PFColors.Blue200)
    };

    const errorTraces = {
      datapoints: tracesError,
      color: (({ datum }) => datum.color) as any,
      legendItem: makeLegend('Error Traces', PFColors.Red200)
    };
    return this.props.errorFetchTraces && this.props.errorFetchTraces.length > 0 ? (
      this.renderFetchEmpty('Error fetching traces', this.props.errorFetchTraces![0].msg)
    ) : this.props.traces.length > 0 ? (
      <div data-test="tracing-scatterplot" className={tracingChartStyle}>
        <div style={{ marginTop: 20 }}>
          <ChartWithLegend<Datapoint, JaegerLineInfo>
            data={[successTraces, errorTraces]}
            fill={true}
            unit="seconds"
            seriesComponent={<ChartScatter />}
            onClick={dp => this.props.setTraceId(this.props.cluster, dp.trace.traceID)}
            onTooltipClose={dp => this.onTooltipClose(dp.trace)}
            onTooltipOpen={dp => this.onTooltipOpen(dp.trace)}
            labelComponent={<TraceTooltip />}
            pointer={true}
          />
        </div>
      </div>
    ) : (
      this.renderFetchEmpty('No traces', 'No trace results. Try another query.')
    );
  }

  private onTooltipClose = (trace?: JaegerTrace): void => {
    // cancel loading the stats if we've moused out of the trace before we started loading
    if (trace === this.nextToLoad) {
      this.nextToLoad = undefined;
    }
  };

  private loadTraceTooltipMetrics(trace: JaegerTrace): void {
    this.isLoading = true;
    if (trace.traceID !== this.props.selectedTrace?.traceID) {
      this.seletedTraceMatched = trace.matched;
    }

    const queries = buildQueriesFromSpans(trace.spans, true);

    this.props
      .loadMetricsStats(queries, true)
      .then(_response => {
        if (this.nextToLoad) {
          const nextTrace = this.nextToLoad;
          this.nextToLoad = undefined;
          this.loadTraceTooltipMetrics(nextTrace);
        } else {
          this.isLoading = false;
        }
      })
      .catch(_err => {
        this.isLoading = false;
      });
  }

  private onTooltipOpen = (trace?: JaegerTrace): void => {
    if (!trace) {
      return;
    }
    if (this.isLoading) {
      // replace any pending load with a load for the currently hovered trace
      this.nextToLoad = trace;
    } else {
      this.loadTraceTooltipMetrics(trace);
    }
  };
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  selectedTrace: state.tracingState.selectedTrace,
  provider: state.tracingState.info?.provider
});

const mapDispatchToProps = (dispatch: KialiDispatch): MapProps => ({
  loadMetricsStats: (queries: MetricsStatsQuery[], isCompact: boolean) =>
    dispatch(MetricsStatsThunkActions.load(queries, isCompact)),
  setTraceId: (cluster?: string, traceId?: string) => dispatch(TracingThunkActions.setTraceId(cluster, traceId))
});

export const TracingScatter = connect(mapStateToProps, mapDispatchToProps)(TracingScatterComponent);
