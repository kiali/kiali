// Copyright (c) 2017 Uber Technologies, Inc.
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

import { createSelector } from 'reselect';

// eslint-disable-next-line import/prefer-default-export
export const formatDependenciesAsNodesAndLinks = createSelector(
  ({ dependencies }) => dependencies,
  dependencies => {
    const data = dependencies.reduce(
      (response, link) => {
        const { nodeMap } = response;
        let { links } = response;

        // add both the parent and child to the node map, or increment their
        // call count.
        nodeMap[link.parent] = nodeMap[link.parent] ? nodeMap[link.parent] + link.callCount : link.callCount;
        nodeMap[link.child] = nodeMap[link.child]
          ? response.nodeMap[link.child] + link.callCount
          : link.callCount;

        // filter out self-dependent
        if (link.parent !== link.child) {
          links = links.concat([
            {
              source: link.parent,
              target: link.child,
              callCount: link.callCount,
              value: Math.max(Math.sqrt(link.callCount / 10000), 1),
              target_node_size: Math.max(Math.log(nodeMap[link.child] / 1000), 3),
            },
          ]);
        }

        return { nodeMap, links };
      },
      { nodeMap: {}, links: [] }
    );

    data.nodes = Object.keys(data.nodeMap).map(id => ({
      callCount: data.nodeMap[id],
      radius: Math.max(Math.log(data.nodeMap[id] / 1000), 3),
      orphan: data.links.findIndex(link => id === link.source || id === link.target) === -1,
      id,
    }));

    const { nodes, links } = data;

    return { nodes, links };
  }
);
