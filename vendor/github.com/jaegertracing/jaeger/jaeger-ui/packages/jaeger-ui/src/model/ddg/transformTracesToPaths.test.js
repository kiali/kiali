// Copyright (c) 2019 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import transformTracesToPaths from './transformTracesToPaths';

describe('transform traces to ddg paths', () => {
  const makeSpan = (spanName, childOf) => ({
    hasChildren: true,
    operationName: `${spanName} operation`,
    processID: `${spanName} processID`,
    references: childOf
      ? [
          {
            refType: 'CHILD_OF',
            span: childOf,
            spanID: childOf.spanID,
          },
        ]
      : [],
    spanID: `${spanName} spanID`,
  });
  const makeTrace = (spans, traceID) => ({
    data: {
      processes: spans.reduce(
        (result, span) => ({
          ...result,
          [span.processID]: {
            serviceName: `${span.spanID.split(' ')[0]} service`,
          },
        }),
        {}
      ),
      spans,
      traceID,
    },
  });

  const linearTraceID = 'linearTraceID';
  const missTraceID = 'missTraceID';
  const shortTraceID = 'shortTraceID';
  const rootSpan = makeSpan('root');
  const childSpan = makeSpan('child', rootSpan);
  const grandchildSpan = makeSpan('grandchild', childSpan);

  it('transforms single short trace result payload', () => {
    const traces = {
      [shortTraceID]: makeTrace([rootSpan, { ...childSpan, hasChildren: false }], shortTraceID),
    };

    const { dependencies: result } = transformTracesToPaths(traces, 'child service');
    expect(result.length).toBe(1);
    expect(result[0].path.length).toBe(2);
  });

  it('transforms multiple traces result payload', () => {
    const traces = {
      [shortTraceID]: makeTrace([rootSpan, { ...childSpan, hasChildren: false }], shortTraceID),
      [linearTraceID]: makeTrace(
        [rootSpan, childSpan, { ...grandchildSpan, hasChildren: false }],
        linearTraceID
      ),
    };

    const { dependencies: result } = transformTracesToPaths(traces, 'child service');
    expect(result.length).toBe(2);
    expect(result[0].path.length).toBe(2);
    expect(result[1].path.length).toBe(3);
  });

  it('ignores paths without focalService', () => {
    const branchingTraceID = 'branchingTraceID';
    const uncleSpan = makeSpan('uncle', rootSpan);
    uncleSpan.hasChildren = false;
    const traces = {
      [missTraceID]: makeTrace([rootSpan, childSpan, uncleSpan], missTraceID),
      [branchingTraceID]: makeTrace(
        [rootSpan, childSpan, uncleSpan, { ...grandchildSpan, hasChildren: false }],
        branchingTraceID
      ),
    };

    const { dependencies: result } = transformTracesToPaths(traces, 'child service');
    expect(result.length).toBe(1);
    expect(result[0].path.length).toBe(3);
  });

  it('matches service and operation names', () => {
    const childSpanWithDiffOp = {
      ...childSpan,
      hasChildren: false,
      operationName: 'diff operation',
    };
    const traces = {
      [missTraceID]: makeTrace([rootSpan, childSpanWithDiffOp], missTraceID),
      [linearTraceID]: makeTrace(
        [rootSpan, childSpan, { ...grandchildSpan, hasChildren: false }],
        linearTraceID
      ),
    };

    const { dependencies: result } = transformTracesToPaths(traces, 'child service');
    expect(result.length).toBe(2);
    expect(result[0].path.length).toBe(2);
    expect(result[1].path.length).toBe(3);

    const { dependencies: resultWithOp } = transformTracesToPaths(traces, 'child service', 'child operation');
    expect(resultWithOp.length).toBe(1);
    expect(resultWithOp[0].path.length).toBe(3);
  });

  it('transforms multiple paths from single trace', () => {
    const traces = {
      [linearTraceID]: makeTrace(
        [rootSpan, { ...childSpan, hasChildren: false }, { ...grandchildSpan, hasChildren: false }],
        linearTraceID
      ),
    };

    const { dependencies: result } = transformTracesToPaths(traces, 'child service');
    expect(result.length).toBe(2);
    expect(result[0].path.length).toBe(2);
    expect(result[1].path.length).toBe(3);
  });

  it('errors if span has ancestor id not in trace data', () => {
    const traces = {
      [linearTraceID]: makeTrace([rootSpan, { ...grandchildSpan, hasChildren: false }], linearTraceID),
    };

    expect(() => transformTracesToPaths(traces, 'child service')).toThrowError(/Ancestor spanID.*not found/);
  });

  it('skips trace without data', () => {
    const traces = {
      [shortTraceID]: makeTrace([rootSpan, { ...childSpan, hasChildren: false }], shortTraceID),
      noData: {},
    };

    const { dependencies: result } = transformTracesToPaths(traces, 'child service');
    expect(result.length).toBe(1);
  });
});
