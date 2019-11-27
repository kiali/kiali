// Copyright (c) 2018 Uber Technologies, Inc.
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

import { TEdge } from '@jaegertracing/plexus/lib/types';

import DagNode from './DagNode';
import { NodeID } from './types';
import TDagVertex from './types/TDagVertex';

export default function convPlexus<T>(nodesMap: Map<NodeID, DagNode<T>>) {
  const vertices: TDagVertex<T>[] = [];
  const edges: TEdge[] = [];
  const nodes = [...nodesMap.values()];
  for (let i = 0; i < nodes.length; i++) {
    const dagNode = nodes[i];
    vertices.push({
      key: dagNode.id,
      data: dagNode,
    });
    if (!dagNode.parentID) {
      continue;
    }
    edges.push({
      from: dagNode.parentID,
      to: dagNode.id,
    });
  }
  return { edges, vertices };
}
