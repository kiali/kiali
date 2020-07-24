import * as React from 'react';
import { ChartWithLegend, makeLegend, LineInfo, VCDataPoint } from '@kiali/k-charted-pf4';
import { ChartScatter } from '@patternfly/react-charts';
import { JaegerError, JaegerTrace } from '../../types/JaegerInfo';
import { isErrorTag } from './JaegerHelper';
import { PfColors } from '../Pf/PfColors';
import { Title, EmptyState, EmptyStateVariant, EmptyStateBody } from '@patternfly/react-core';

import jaegerIcon from '../../assets/img/jaeger-icon.svg';
import * as MetricsHelper from '../Metrics/Helper';
import { retrieveTimeRange } from 'components/Time/TimeRangeHelper';
import { evalTimeRange } from 'types/Common';

interface JaegerScatterProps {
  traces: JaegerTrace[];
  onClick: (traceId) => void;
  fixedTime: boolean;
  errorTraces?: boolean;
  errorFetchTraces?: JaegerError[];
}

const ONE_MILLISECOND = 1000000;

const MINIMAL_SIZE = 2;

type JaegerLineInfo = LineInfo & { id: string };
type Datapoint = VCDataPoint & JaegerLineInfo;

export class JaegerScatter extends React.Component<JaegerScatterProps> {
  renderFetchEmtpy = (title, msg) => {
    return (
      <EmptyState variant={EmptyStateVariant.full}>
        <img alt="Jaeger Link" src={jaegerIcon} className={'pf-c-empty-state__icon'} />
        <Title headingLevel="h5" size="lg">
          {title}
        </Title>
        <EmptyStateBody>{msg}</EmptyStateBody>
      </EmptyState>
    );
  };
  render() {
    const tracesRaw: Datapoint[] = [];
    const tracesError: Datapoint[] = [];

    this.props.traces.forEach(trace => {
      const traceError = trace.spans.filter(sp => sp.tags.some(isErrorTag)).length > 0;
      const traceItem = {
        x: new Date(trace.startTime / 1000),
        y: Number(trace.duration / ONE_MILLISECOND),
        name: `${trace.traceName !== '' ? trace.traceName : '<trace-without-root-span>'} (${trace.traceID.slice(
          0,
          7
        )})`,
        color: PfColors.Blue200,
        unit: 'seconds',
        id: trace.traceID,
        size: trace.spans.length + MINIMAL_SIZE
      };
      if (traceError) {
        traceItem.color = PfColors.Red200;
        tracesError.push(traceItem);
      } else {
        tracesRaw.push(traceItem);
      }
    });
    const traces = {
      datapoints: tracesRaw,
      color: (({ datum }) => datum.color) as any,
      legendItem: makeLegend('Traces', PfColors.Blue200)
    };

    const errorTraces = {
      datapoints: tracesError,
      color: (({ datum }) => datum.color) as any,
      legendItem: makeLegend('Error Traces', PfColors.Red200)
    };

    return this.props.errorFetchTraces && this.props.errorFetchTraces.length > 0 ? (
      this.renderFetchEmtpy('Error fetching Traces in Tracing tool', this.props.errorFetchTraces![0].msg)
    ) : this.props.traces.length > 0 ? (
      <ChartWithLegend<Datapoint, JaegerLineInfo>
        data={[traces, errorTraces]}
        fill={true}
        unit="seconds"
        seriesComponent={<ChartScatter />}
        timeWindow={
          this.props.fixedTime ? evalTimeRange(retrieveTimeRange() || MetricsHelper.defaultMetricsDuration) : undefined
        }
        onClick={dp => this.props.onClick(dp.id)}
      />
    ) : (
      this.renderFetchEmtpy('No traces', 'No trace results. Try another query.')
    );
  }
}
