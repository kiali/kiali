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

import memoizeOne from 'memoize-one';

import spanAncestorIds from '../../utils/span-ancestor-ids';

import { TDdgPayloadEntry, TDdgPayloadPath, TDdgPayload } from './types';
import { FetchedTrace } from '../../types';
import { Span, Trace } from '../../types/trace';

function convertSpan(span: Span, trace: Trace): TDdgPayloadEntry {
  const serviceName = trace.processes[span.processID].serviceName;
  const operationName = span.operationName;
  return { service: serviceName, operation: operationName };
}

function transformTracesToPaths(
  traces: Record<string, FetchedTrace>,
  focalService: string,
  focalOperation: string | undefined
): TDdgPayload {
  const dependencies: TDdgPayloadPath[] = [];
  Object.values(traces).forEach(({ data }) => {
    if (data) {
      const spanMap: Map<string, Span> = new Map();
      const { traceID } = data;
      data.spans
        .filter(span => {
          spanMap.set(span.spanID, span);
          return !span.hasChildren;
        })
        .forEach(leaf => {
          const path = spanAncestorIds(leaf).map(id => {
            const span = spanMap.get(id);
            if (!span) throw new Error(`Ancestor spanID ${id} not found in trace ${traceID}`);

            return convertSpan(span, data);
          });
          path.push(convertSpan(leaf, data));

          if (
            path.some(
              ({ service, operation }) =>
                service === focalService && (!focalOperation || operation === focalOperation)
            )
          ) {
            dependencies.push({
              path,
              attributes: [
                {
                  key: 'exemplar_trace_id',
                  value: traceID,
                },
              ],
            });
          }
        });
    }
  });
  return { dependencies };
}

export default memoizeOne(transformTracesToPaths);
