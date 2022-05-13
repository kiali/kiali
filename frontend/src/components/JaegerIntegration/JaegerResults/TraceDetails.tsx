import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import _round from 'lodash/round';
import { Button, ButtonVariant, Card, CardBody, Grid, GridItem, Tooltip } from '@patternfly/react-core';
import { InfoAltIcon, WarningTriangleIcon } from '@patternfly/react-icons';

import { JaegerTrace, RichSpanData } from 'types/JaegerInfo';
import { JaegerTraceTitle } from './JaegerTraceTitle';
import { CytoscapeGraphSelectorBuilder } from 'components/CytoscapeGraph/CytoscapeGraphSelector';
import { GraphType, NodeType } from 'types/Graph';
import { FormattedTraceInfo, shortIDStyle } from './FormattedTraceInfo';
import { PFColors } from 'components/Pf/PfColors';
import { KialiAppState } from 'store/Store';
import { KialiAppAction } from 'actions/KialiAppAction';
import { JaegerThunkActions } from 'actions/JaegerThunkActions';
import { getTraceId } from 'utils/SearchParamUtils';
import { average } from 'utils/MathUtils';
import {
  averageSpanDuration,
  buildQueriesFromSpans,
  isSimilarTrace,
  reduceMetricsStats,
  StatsMatrix
} from 'utils/tracing/TraceStats';
import { TraceLabels } from './TraceLabels';
import { TargetKind } from 'types/Common';
import { MetricsStatsQuery } from 'types/MetricsOptions';
import MetricsStatsThunkActions from 'actions/MetricsStatsThunkActions';
import { renderTraceHeatMap } from './StatsComparison';
import { HeatMap } from 'components/HeatMap/HeatMap';
import { formatDuration, sameSpans } from 'utils/tracing/TracingHelper';

interface Props {
  otherTraces: JaegerTrace[];
  jaegerURL: string;
  namespace: string;
  target: string;
  targetKind: TargetKind;
  setTraceId: (traceId?: string) => void;
  trace?: JaegerTrace;
  loadMetricsStats: (queries: MetricsStatsQuery[]) => void;
  statsMatrix?: StatsMatrix;
  isStatsMatrixComplete: boolean;
}

interface State {}
export const heatmapIntervals = ['10m', '60m', '6h'];

class TraceDetails extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const urlTrace = getTraceId();
    if (urlTrace && urlTrace !== props.trace?.traceID) {
      props.setTraceId(urlTrace);
    } else if (!urlTrace && props.trace) {
      // Remove old stored selected trace
      props.setTraceId(undefined);
    }
    this.state = { completeMetricsStats: false };
  }

  componentDidMount() {
    if (this.props.trace) {
      this.fetchComparisonMetrics(this.props.trace.spans);
    }
  }

  componentDidUpdate(prevProps: Readonly<Props>) {
    if (this.props.trace && !sameSpans(prevProps.trace?.spans || [], this.props.trace.spans)) {
      this.fetchComparisonMetrics(this.props.trace.spans);
    }
  }

  private fetchComparisonMetrics(spans: RichSpanData[]) {
    const queries = buildQueriesFromSpans(spans);
    this.props.loadMetricsStats(queries);
  }

  private getGraphURL = (traceID: string) => {
    let cytoscapeGraph = new CytoscapeGraphSelectorBuilder().namespace(this.props.namespace);
    let graphType: GraphType = GraphType.APP;

    switch (this.props.targetKind) {
      case 'app':
        cytoscapeGraph = cytoscapeGraph.app(this.props.target).nodeType(NodeType.APP);
        break;
      case 'service':
        graphType = GraphType.SERVICE;
        cytoscapeGraph = cytoscapeGraph.service(this.props.target);
        break;
      case 'workload':
        graphType = GraphType.WORKLOAD;
        cytoscapeGraph = cytoscapeGraph.workload(this.props.target);
        break;
    }

    return `/graph/namespaces?graphType=${graphType}&injectServiceNodes=true&namespaces=${
      this.props.namespace
    }&traceId=${traceID}&focusSelector=${encodeURI(cytoscapeGraph.build())}`;
  };

  private renderSimilarHeatmap = (
    similarTraces: JaegerTrace[],
    traceDuration: number,
    avgSpanDuration: number | undefined
  ) => {
    const similarMeanDuration = average(similarTraces, trace => trace.duration);
    const similarSpanDurations = similarTraces
      .map(t => averageSpanDuration(t))
      .filter(d => d !== undefined) as number[];
    const similarMeanAvgSpanDuration = average(similarSpanDurations, d => d);
    const genDiff = (a: number | undefined, b: number | undefined) => (a && b ? (a - b) / 1000 : undefined);
    const similarTracesToShow = similarTraces.slice(0, 8);
    const similarMatrixHeaders = similarTracesToShow
      .map(t => {
        const info = new FormattedTraceInfo(t);
        return (
          <Tooltip
            content={
              <>
                {info.name()}
                <span className={shortIDStyle}>{info.shortID()}</span>
                <small>({info.fromNow()})</small>
              </>
            }
          >
            <Button
              style={{ paddingLeft: 0, paddingRight: 3, fontSize: '0.7rem' }}
              variant={ButtonVariant.link}
              onClick={() => this.props.setTraceId(t.traceID)}
            >
              {info.shortID()}
            </Button>
          </Tooltip>
        );
      })
      .concat([<>Mean</>]);
    const similarMatrix = similarTracesToShow
      .map(t => {
        const avgSpans = averageSpanDuration(t);
        return [genDiff(traceDuration, t.duration), genDiff(avgSpanDuration, avgSpans)];
      })
      .concat([[genDiff(traceDuration, similarMeanDuration), genDiff(avgSpanDuration, similarMeanAvgSpanDuration)]]);
    return (
      <HeatMap
        xLabels={similarMatrixHeaders}
        yLabels={[`Full duration`, `Spans average`]}
        data={similarMatrix}
        displayMode={'large'}
        colorMap={HeatMap.HealthColorMap}
        dataRange={{ from: -10, to: 10 }}
        colorUndefined={PFColors.Black200}
        valueFormat={v => (v > 0 ? '+' : '') + _round(v, 1)}
        tooltip={(x, _, v) => {
          // Build explanation tooltip
          const slowOrFast = v > 0 ? 'slower' : 'faster';
          const diff = _round(Math.abs(v), 2);
          const versus =
            x === similarTracesToShow.length
              ? 'the mean of all similar traces on chart'
              : similarTracesToShow[x].traceID;
          return `This trace was ${diff}ms ${slowOrFast} than ${versus}`;
        }}
      />
    );
  };

  render() {
    const { trace, otherTraces, jaegerURL } = this.props;
    if (!trace) {
      return null;
    }
    const formattedTrace = new FormattedTraceInfo(trace);

    // Compute a bunch of stats
    const avgSpanDuration = averageSpanDuration(trace);
    const similarTraces = otherTraces.filter(t => t.traceID !== trace.traceID && isSimilarTrace(t, trace));
    const comparisonLink =
      this.props.jaegerURL && similarTraces.length > 0
        ? `${this.props.jaegerURL}/trace/${trace.traceID}...${similarTraces[0].traceID}?cohort=${
            trace.traceID
          }${similarTraces
            .slice(0, 10)
            .map(t => `&cohort=${t.traceID}`)
            .join('')}`
        : undefined;

    return (
      <Card isCompact style={{ border: '1px solid #e6e6e6' }}>
        <JaegerTraceTitle
          formattedTrace={formattedTrace}
          externalURL={jaegerURL ? `${jaegerURL}/trace/${trace.traceID}` : undefined}
          graphURL={this.getGraphURL(trace.traceID)}
          comparisonURL={comparisonLink}
        />
        <CardBody>
          <Grid style={{ marginTop: '20px' }}>
            <GridItem span={3}>
              <TraceLabels spans={trace.spans} oneline={false} />
            </GridItem>
            <GridItem span={3}>
              <Tooltip content={<>The full trace duration is (trace end time) - (trace start time).</>}>
                <strong>Full duration: </strong>
              </Tooltip>
              {formatDuration(trace.duration)}
              <br />
              <Tooltip
                content={
                  <>
                    The average duration of all spans within the trace. It differs from full duration, as spans can run
                    in parallel, or there can be dead time between spans.
                  </>
                }
              >
                <strong>Spans average duration: </strong>
              </Tooltip>
              {avgSpanDuration ? formatDuration(avgSpanDuration) : 'n/a'}
              <br />
              <br />
              {this.props.statsMatrix && (
                <>
                  <strong>Compared with metrics: </strong>
                  {renderTraceHeatMap(this.props.statsMatrix, heatmapIntervals, false)}
                  {!this.props.isStatsMatrixComplete && (
                    <>
                      <WarningTriangleIcon /> Incomplete data, check Span Details
                    </>
                  )}
                </>
              )}
            </GridItem>
            <GridItem span={6}>
              <Tooltip content="Traces are identified as similar based on counting the number of spans and the occurrences of operation names. Only traces currently on the chart are processed.">
                <>
                  <InfoAltIcon /> <strong>Similar traces</strong>
                  <br />
                </>
              </Tooltip>
              {similarTraces.length > 0
                ? this.renderSimilarHeatmap(similarTraces, trace.duration, avgSpanDuration)
                : 'No similar traces found'}
            </GridItem>
          </Grid>
        </CardBody>
      </Card>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  if (state.jaegerState.selectedTrace) {
    const { matrix, isComplete } = reduceMetricsStats(
      state.jaegerState.selectedTrace,
      heatmapIntervals,
      state.metricsStats.data
    );
    return {
      trace: state.jaegerState.selectedTrace,
      statsMatrix: matrix,
      isStatsMatrixComplete: isComplete
    };
  }
  return {
    trace: state.jaegerState.selectedTrace,
    isStatsMatrixComplete: false
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setTraceId: (traceId?: string) => dispatch(JaegerThunkActions.setTraceId(traceId)),
  loadMetricsStats: (queries: MetricsStatsQuery[]) => dispatch(MetricsStatsThunkActions.load(queries))
});

const TraceDetailsContainer = connect(mapStateToProps, mapDispatchToProps)(TraceDetails);
export default TraceDetailsContainer;
