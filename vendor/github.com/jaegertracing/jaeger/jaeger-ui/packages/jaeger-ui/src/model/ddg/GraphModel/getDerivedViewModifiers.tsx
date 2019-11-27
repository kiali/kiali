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

import GraphModel from './index';
import getEdgeId from './getEdgeId';
import { decode } from '../visibility-codec';
import { EViewModifier } from '../types';

function getKeyFromVisIdx(graph: GraphModel, visIdx: number) {
  const pe = graph.visIdxToPathElem[visIdx];
  if (!pe) {
    throw new Error(`Invalid vis ids: ${visIdx}`);
  }
  const vertex = graph.pathElemToVertex.get(pe);
  if (!vertex) {
    throw new Error(`Path elem without vertex: ${pe}`);
  }
  return vertex.key;
}

export default function getDerivedViewModifiers(
  this: GraphModel,
  visEncoding: string | undefined,
  viewModifiers: Map<number, number>
) {
  const vertices = new Map<string, number>();
  const edges = new Map<string, number>();

  const visibleIndices = new Set(
    visEncoding == null
      ? this.getDefaultVisiblePathElems().map(pe => pe.visibilityIdx)
      : new Set(decode(visEncoding))
  );

  const pushVertexVm = (vm: number, key: string) => {
    // eslint-disable-next-line no-bitwise
    vertices.set(key, (vertices.get(key) || 0) | vm);
  };

  const pushEdgeVm = (vm: number, from: string, to: string) => {
    const edgeId = getEdgeId(from, to);
    // eslint-disable-next-line no-bitwise
    edges.set(edgeId, (edges.get(edgeId) || 0) | vm);
  };

  viewModifiers.forEach((vm, visIdx) => {
    if (!visibleIndices.has(visIdx)) {
      return;
    }
    pushVertexVm(vm, getKeyFromVisIdx(this, visIdx));
    if (vm !== EViewModifier.Hovered) {
      return;
    }
    const hoveredPe = this.visIdxToPathElem[visIdx];
    /* istanbul ignore next : getKeyFromVisIdx would have thrown if visIdx was invalid */
    if (!hoveredPe) throw new Error(`Invalid vis index: ${visIdx}`);
    const members = hoveredPe.memberOf.members;
    let lastKey: string | null = null;
    for (let i = 0; i < members.length; i++) {
      const pe = members[i];
      if (!visibleIndices.has(pe.visibilityIdx)) {
        lastKey = null;
        continue;
      }
      const key = getKeyFromVisIdx(this, members[i].visibilityIdx);
      pushVertexVm(EViewModifier.PathHovered, key);
      if (lastKey) {
        pushEdgeVm(EViewModifier.PathHovered, lastKey, key);
      }
      lastKey = key;
    }
  });
  return { edges, vertices };
}
