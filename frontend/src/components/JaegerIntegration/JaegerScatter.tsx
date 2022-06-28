import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { ChartScatter } from '@patternfly/react-charts';
import { Title, EmptyState, EmptyStateVariant, EmptyStateBody, TitleSizes } from '@patternfly/react-core';

import { JaegerError, JaegerTrace } from '../../types/JaegerInfo';
import { PFColors } from '../Pf/PfColors';

import { evalTimeRange } from 'types/Common';
import { KialiAppState } from 'store/Store';
import { KialiAppAction } from 'actions/KialiAppAction';
import { JaegerThunkActions } from 'actions/JaegerThunkActions';
import { LineInfo, makeLegend, VCDataPoint } from 'types/VictoryChartInfo';
import ChartWithLegend from 'components/Charts/ChartWithLegend';
import { durationSelector } from '../../store/Selectors';
import { TraceTooltip } from './TraceTooltip';
import { isErrorTag } from 'utils/tracing/TracingHelper';
import { averageSpanDuration } from 'utils/tracing/TraceStats';
import { style } from 'typestyle';

interface JaegerScatterProps {
  duration: number;
  traces: JaegerTrace[];
  showSpansAverage: boolean;
  errorTraces?: boolean;
  errorFetchTraces?: JaegerError[];
  setTraceId: (traceId?: string) => void;
  selectedTrace?: JaegerTrace;
}

const ONE_MILLISECOND = 1000000;
const MINIMAL_SIZE = 2;
const MAXIMAL_SIZE = 30;

export type JaegerLineInfo = LineInfo & { trace: JaegerTrace };
type Datapoint = VCDataPoint & JaegerLineInfo;

const jaegerChartStyle = style({
  paddingTop: 15,
  paddingLeft: 25,
  paddingRight: 25,
  paddingBottom: 15
});

const emptyStyle = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  // fix height + padding
  height: '350px',
  textAlign: 'center'
});

class JaegerScatter extends React.Component<JaegerScatterProps> {
  renderFetchEmtpy = (title, msg) => {
    return (
      <div className={emptyStyle}>
        <EmptyState variant={EmptyStateVariant.small}>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            {title}
          </Title>
          <EmptyStateBody>{msg}</EmptyStateBody>
        </EmptyState>
      </div>
    );
  };
  render() {
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
        size: Math.min(MAXIMAL_SIZE, trace.spans.length + MINIMAL_SIZE)
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
      this.renderFetchEmtpy('Error fetching traces', this.props.errorFetchTraces![0].msg)
    ) : this.props.traces.length > 0 ? (
      <div data-test="jaeger-scatterplot" className={jaegerChartStyle}>
        <div style={{ marginTop: 20 }}>
          <ChartWithLegend<Datapoint, JaegerLineInfo>
            data={[successTraces, errorTraces]}
            fill={true}
            unit="seconds"
            seriesComponent={<ChartScatter />}
            onClick={dp => this.props.setTraceId(dp.trace.traceID)}
            labelComponent={<TraceTooltip />}
          />
        </div>
      </div>
    ) : (
      this.renderFetchEmtpy('No traces', 'No trace results. Try another query.')
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  selectedTrace: state.jaegerState.selectedTrace
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setTraceId: (traceId?: string) => dispatch(JaegerThunkActions.setTraceId(traceId))
});

const Container = connect(mapStateToProps, mapDispatchToProps)(JaegerScatter);
export default Container;
