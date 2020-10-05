import { JaegerTrace, Span } from 'types/JaegerInfo';
import { averageSpanDuration, isSimilarTrace } from 'utils/TraceStats';

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
