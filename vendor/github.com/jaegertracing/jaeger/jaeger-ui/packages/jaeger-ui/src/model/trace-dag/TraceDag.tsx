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

import DagNode from './DagNode';
import DenseTrace from './DenseTrace';
import { DiffCounts, NodeID } from './types';
import { TNil } from '../../types';
import { Trace } from '../../types/trace';

export default class TraceDag<T = void> {
  static newFromTrace(trace: Trace) {
    const dt: TraceDag<any> = new TraceDag();
    dt._initFromTrace(trace, undefined);
    return dt;
  }

  static diff(a: TraceDag<any>, b: TraceDag<any>) {
    const dt: TraceDag<DiffCounts> = new TraceDag();
    let key: 'a' | 'b' = 'a';

    function pushDagNode(src: DagNode<any>) {
      const node = dt._getDagNode(src.service, src.operation, src.children.size > 0, src.parentID, {
        a: 0,
        b: 0,
      });
      const { data } = node;
      data[key] = src.count;
      node.members.push(...src.members);
      node.count = data.b - data.a;
      if (!node.parentID) {
        dt.rootIDs.add(node.id);
      }
    }
    key = 'a';
    [...a.nodesMap.values()].forEach(pushDagNode);
    key = 'b';
    [...b.nodesMap.values()].forEach(pushDagNode);
    return dt;
  }

  denseTrace: DenseTrace | null;
  nodesMap: Map<NodeID, DagNode<T>>;
  rootIDs: Set<NodeID>;

  constructor() {
    this.denseTrace = null;
    this.nodesMap = new Map();
    this.rootIDs = new Set();
  }

  _initFromTrace(trace: Trace, data: T) {
    this.denseTrace = new DenseTrace(trace);
    [...this.denseTrace.rootIDs].forEach(id => this._addDenseSpan(id, null, data));
  }

  _getDagNode(
    service: string,
    operation: string,
    hasChildren: boolean,
    parentID: NodeID | TNil,
    data: T
  ): DagNode<T> {
    const nodeID = DagNode.getID(service, operation, hasChildren, parentID);
    const existing = this.nodesMap.get(nodeID);
    if (existing) {
      return existing;
    }
    const node = new DagNode(service, operation, hasChildren, parentID, data);
    this.nodesMap.set(nodeID, node);
    if (!parentID) {
      this.rootIDs.add(nodeID);
    } else {
      const parentDag = this.nodesMap.get(parentID);
      if (parentDag) {
        parentDag.children.add(nodeID);
      }
    }
    return node;
  }

  _addDenseSpan(spanID: string, parentNodeID: NodeID | TNil, data: T) {
    const denseSpan = this.denseTrace && this.denseTrace.denseSpansMap.get(spanID);
    if (!denseSpan) {
      // eslint-disable-next-line no-console
      console.warn(`Missing dense span: ${spanID}`);
      return;
    }
    const { children, operation, service, skipToChild } = denseSpan;
    let nodeID: string | TNil = null;
    if (!skipToChild) {
      const node = this._getDagNode(service, operation, children.size > 0, parentNodeID, data);
      node.count++;
      node.addMember(denseSpan);
      nodeID = node.id;
    } else {
      nodeID = parentNodeID;
    }
    [...children].forEach(id => this._addDenseSpan(id, nodeID, data));
  }
}
