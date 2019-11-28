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

import { TVertexKey } from '@jaegertracing/plexus/lib/types';
import _get from 'lodash/get';
import _map from 'lodash/map';
import memoizeOne from 'memoize-one';

import convPlexus from '../../../model/trace-dag/convPlexus';
import TraceDag from '../../../model/trace-dag/TraceDag';
import { DiffCounts } from '../../../model/trace-dag/types';
import TDagVertex from '../../../model/trace-dag/types/TDagVertex';
import { Trace } from '../../../types/trace';
import filterSpans from '../../../utils/filter-spans';

function getUiFindVertexKeysFn(uiFind: string, vertices: TDagVertex<any>[]): Set<TVertexKey> {
  if (!uiFind) return new Set<TVertexKey>();
  const newVertexKeys: Set<TVertexKey> = new Set();
  vertices.forEach(({ key, data: { members } }) => {
    if (_get(filterSpans(uiFind, _map(members, 'span')), 'size')) {
      newVertexKeys.add(key);
    }
  });
  return newVertexKeys;
}

export const getUiFindVertexKeys = memoizeOne(getUiFindVertexKeysFn);

function getEdgesAndVerticesFn(aData: Trace, bData: Trace) {
  const aTraceDag = TraceDag.newFromTrace(aData);
  const bTraceDag = TraceDag.newFromTrace(bData);
  const diffDag = TraceDag.diff(aTraceDag, bTraceDag);
  return convPlexus<DiffCounts>(diffDag.nodesMap);
}

export const getEdgesAndVertices = memoizeOne(getEdgesAndVerticesFn);
