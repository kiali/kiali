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

import * as React from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { render } from 'react-dom';

import { LayoutManager } from '../../src';
// TODO(joe): Update import after killing `DirectedGraph`
import Digraph from '../../src/Digraph';
import { TVertex } from '../../src/types';

const vertices = [
  { key: 'web', name: 'web-app : login' },
  { key: 'users', name: 'user-store : get-user' },
  { key: 'cache', name: 'cache : get' },
  { key: 'db', name: 'db : get-user' },
  { key: 'auth', name: 'auth : login' },
];

// Edges must refer to the `key` field of vertices.
const edges = [
  { from: 'web', to: 'users' },
  { from: 'web', to: 'auth' },
  { from: 'users', to: 'cache' },
  { from: 'users', to: 'db' },
];

const lm = new LayoutManager({ useDotEdges: true, rankdir: 'TB', ranksep: 1.1 });

const UxEdges = () => (
  <Digraph
    edges={edges}
    vertices={vertices}
    setOnGraph={{
      style: {
        fontFamily: 'sans-serif',
        height: '100%',
        position: 'fixed',
        width: '100%',
      },
    }}
    layoutManager={lm}
    measurableNodesKey="nodes"
    layers={[
      {
        key: 'edges-layers',
        layerType: 'svg',
        defs: [{ localId: 'arrow-head' }],
        layers: [
          {
            key: 'edges',
            markerEndId: 'arrow-head',
            edges: true,
          },
          {
            key: 'edges-pointer-area',
            edges: true,
            setOnContainer: { style: { cursor: 'default', opacity: 0, strokeWidth: 4 } },
            setOnEdge: layoutEdge => ({
              // eslint-disable-next-line no-console
              onMouseOver: () => console.log('mouse over', layoutEdge),
              // eslint-disable-next-line no-console
              onMouseOut: () => console.log('mouse out', layoutEdge),
            }),
          },
        ],
      },
      {
        key: 'nodes',
        layerType: 'html',
        measurable: true,
        renderNode: (vertex: TVertex<{ name: string }>) => vertex.name,
        setOnNode: { style: { padding: '1rem', whiteSpace: 'nowrap', background: '#e8e8e8' } },
      },
    ]}
  />
);

render(<UxEdges />, document.querySelector('#root'));
