import { EnvoySpanInfo, JaegerTrace, Span, RichSpanData } from 'types/TracingInfo';
import { MetricsStats } from 'types/Metrics';
import { statsQueryToKey } from 'types/MetricsOptions';
import { averageSpanDuration, buildQueriesFromSpans, isSimilarTrace, reduceMetricsStats } from '../TraceStats';

const traceBase = {
  spans: [
    { operationName: 'op1', duration: 5.5 },
    { operationName: 'op1', duration: 3 },
    { operationName: 'op2', duration: 0 },
    { operationName: 'op1', duration: 7.4 }
  ] as Span[]
} as JaegerTrace;

const traceSameSpans = {
  spans: [
    { operationName: 'op1', duration: 10 },
    { operationName: 'op1', duration: 10 },
    { operationName: 'op2', duration: 10 },
    { operationName: 'op1', duration: 10 }
  ] as Span[]
} as JaegerTrace;

const traceAlmostSameMoreSpan = {
  spans: [
    { operationName: 'op1', duration: 5.5 },
    { operationName: 'op1', duration: 3 },
    { operationName: 'op1', duration: 10 },
    { operationName: 'op2', duration: 0 },
    { operationName: 'op1', duration: 7.4 }
  ] as Span[]
} as JaegerTrace;

const traceAlmostSameDifferentOp = {
  spans: [
    { operationName: 'op1', duration: 5.5 },
    { operationName: 'op1', duration: 3 },
    { operationName: 'op2', duration: 0 },
    { operationName: 'op3', duration: 7.4 }
  ] as Span[]
} as JaegerTrace;

const traceLessSpans = {
  spans: [
    { operationName: 'op1', duration: 5.5 },
    { operationName: 'op1', duration: 3 }
  ] as Span[]
} as JaegerTrace;

const traceDifferentOperations = {
  spans: [
    { operationName: 'op3', duration: 5.5 },
    { operationName: 'op3', duration: 3 },
    { operationName: 'op2', duration: 0 },
    { operationName: 'op3', duration: 7.4 }
  ] as Span[]
} as JaegerTrace;

const mockEnvoySpan = (op: string, duration: number, wkd: string): RichSpanData => {
  const spanInfo = { direction: 'inbound' } as EnvoySpanInfo;
  return {
    type: 'envoy',
    info: spanInfo,
    operationName: op,
    duration: duration * 1000,
    namespace: 'ns',
    workload: wkd
  } as RichSpanData;
};
const mockStats = (avg: number, p50: number, p90: number, p99: number, isCompact = false) => {
  return {
    isCompact: isCompact,
    responseTimes: [
      { name: 'avg', value: avg },
      { name: '0.5', value: p50 },
      { name: '0.9', value: p90 },
      { name: '0.99', value: p99 }
    ]
  };
};

describe('TraceStats.averageSpanDuration', () => {
  it('should compute average duration', () => {
    // Note: 0 is filtered-out
    expect(averageSpanDuration(traceBase)).toEqual(5.3);
  });
});

describe('TraceStats.isSimilarTrace', () => {
  it('should tell same trace is similar', () => {
    expect(isSimilarTrace(traceBase, traceSameSpans)).toBe(true);
    expect(isSimilarTrace(traceSameSpans, traceBase)).toBe(true);
  });

  it('should tell almost same trace (more spans) is similar', () => {
    expect(isSimilarTrace(traceBase, traceAlmostSameMoreSpan)).toBe(true);
    expect(isSimilarTrace(traceAlmostSameMoreSpan, traceBase)).toBe(true);
  });

  it('should tell almost same trace (diff op) is similar', () => {
    expect(isSimilarTrace(traceBase, traceAlmostSameDifferentOp)).toBe(true);
    expect(isSimilarTrace(traceAlmostSameDifferentOp, traceBase)).toBe(true);
  });

  it('should tell much less spans is not similar', () => {
    expect(isSimilarTrace(traceBase, traceLessSpans)).toBe(false);
    expect(isSimilarTrace(traceLessSpans, traceBase)).toBe(false);
  });

  it('should tell very different operations is not similar', () => {
    expect(isSimilarTrace(traceBase, traceDifferentOperations)).toBe(false);
    expect(isSimilarTrace(traceDifferentOperations, traceBase)).toBe(false);
  });
});

describe('TraceStats.reduceMetricsStats', () => {
  const trace = {
    spans: [mockEnvoySpan('op1', 3, 'w1'), mockEnvoySpan('op2', 3, 'w1'), mockEnvoySpan('op3', 1, 'w2')] as Span[]
  } as JaegerTrace;

  it('should reduce span matrices with complete stats', () => {
    const metricsStats = new Map<string, MetricsStats>([
      ['ns:workload:w1::inbound:10m', mockStats(3, 2, 5, 7)],
      ['ns:workload:w1::inbound:60m', mockStats(2, 2, 6, 10)],
      ['ns:workload:w2::inbound:10m', mockStats(1, 1, 1, 1)],
      ['ns:workload:w2::inbound:60m', mockStats(1, 1, 1, 1)]
    ]);

    const reduced = reduceMetricsStats(trace, metricsStats, false);

    expect(reduced.isComplete).toBe(true);
    expect(reduced.matrix).toHaveLength(4);
    reduced.matrix.forEach(line => expect(line).toHaveLength(3)); // because there are 3 intervals, only 2 of which are filled
    // For each matrix cell (stat_x_duration), the reduced matrix contains
    // the average of "span duration - corresponding metric stat" for all 3 spans
    expect(reduced.matrix[0][0]).toBeCloseTo(0, 5); // 10m avg => average of [3-3, 3-3, 1-1]
    expect(reduced.matrix[0][1]).toBeCloseTo(0.666, 2); // 60m avg => average of [3-2, 3-2, 1-1]
    expect(reduced.matrix[1][0]).toBeCloseTo(0.666, 2); // 10m p50 => average of [3-2, 3-2, 1-1]
    expect(reduced.matrix[1][1]).toBeCloseTo(0.666, 2); // 60m p50 => average of [3-2, 3-2, 1-1]
    expect(reduced.matrix[2][0]).toBeCloseTo(-1.333, 2); // 10m p90 => average of [3-5, 3-5, 1-1]
    expect(reduced.matrix[2][1]).toBeCloseTo(-2, 5); // 60m p90 => average of [3-6, 3-6, 1-1]
    expect(reduced.matrix[3][0]).toBeCloseTo(-2.666, 2); // 10m p99 => average of [3-7, 3-7, 1-1]
    expect(reduced.matrix[3][1]).toBeCloseTo(-4.666, 2); // 60m p99 => average of [3-10, 3-10, 1-1]
  });

  it('should reduce span matrices with incomplete stats', () => {
    const metricsStats = new Map<string, MetricsStats>([
      ['ns:workload:w1::inbound:10m', mockStats(3, 2, 5, 7)],
      ['ns:workload:w1::inbound:60m', mockStats(2, 2, 6, 10)]
    ]);

    const reduced = reduceMetricsStats(trace, metricsStats, false);

    expect(reduced.isComplete).toBe(false);
    expect(reduced.matrix).toHaveLength(4);
    reduced.matrix.forEach(line => expect(line).toHaveLength(3)); // because there are 3 intervals, only 2 of which are filled
    expect(reduced.matrix[0][0]).toBeCloseTo(0, 5); // 10m avg => average of [3-3, 3-3]
    expect(reduced.matrix[0][1]).toBeCloseTo(1, 5); // 60m avg => average of [3-2, 3-2]
    expect(reduced.matrix[1][0]).toBeCloseTo(1, 5); // 10m p50 => average of [3-2, 3-2]
    expect(reduced.matrix[1][1]).toBeCloseTo(1, 5); // 60m p50 => average of [3-2, 3-2]
    expect(reduced.matrix[2][0]).toBeCloseTo(-2, 5); // 10m p90 => average of [3-5, 3-5]
    expect(reduced.matrix[2][1]).toBeCloseTo(-3, 5); // 60m p90 => average of [3-6, 3-6]
    expect(reduced.matrix[3][0]).toBeCloseTo(-4, 5); // 10m p99 => average of [3-7, 3-7]
    expect(reduced.matrix[3][1]).toBeCloseTo(-7, 5); // 60m p99 => average of [3-10, 3-10]
  });
});

describe('TraceStats.buildQueriesFromSpans', () => {
  const spans = [
    mockEnvoySpan('op1', 3, 'w1'),
    mockEnvoySpan('op2', 3, 'w1'),
    mockEnvoySpan('op3', 1, 'w2')
  ] as RichSpanData[];

  it('should build one query per workload and time interval', () => {
    const queries = buildQueriesFromSpans(spans, false);
    expect(queries).toHaveLength(6);
    expect(queries.map(q => statsQueryToKey(q))).toEqual([
      'ns:workload:w1::inbound:10m',
      'ns:workload:w1::inbound:60m',
      'ns:workload:w1::inbound:3h',
      'ns:workload:w2::inbound:10m',
      'ns:workload:w2::inbound:60m',
      'ns:workload:w2::inbound:3h'
    ]);
  });

  it('should cap to eight spans', () => {
    const spans = new Array(20).fill(0).map((_, idx) => {
      return mockEnvoySpan('operation', 1, 'worload-' + idx);
    });
    expect(spans).toHaveLength(20);
    const queries = buildQueriesFromSpans(spans, false);
    expect(queries).toHaveLength(8 * 3); // three intervals x 8-capped number of spans/workloads
  });
});
