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

import * as React from 'react';

export const varied = {
  vertices: [
    { key: 'string key 0', data: { value: new Date(), message: 'vertex w a string key that has spaces' } },
    {
      key: 1,
      label: 'Key is the number 1Key is the number 1Key',
      data: { err: new Error(9), message: 'vertex with a number key and a string label' },
    },
    { key: '2', label: <h3>OMG an H3</h3>, data: { message: 'label is an H3 React element' } },
    {
      key: 33,
      label: 'Key is the number 1Key is the number 1Key',
      data: { value: /abc/, message: 'data contains a RegExp and the node lacks a label' },
    },
  ],
  edges: [
    { from: 'string key 0', to: 1, label: 'The Great Edge Label', data: 'Edge with a string label' },
    {
      from: 'string key 0',
      to: '2',
      label: <strong>Drop it like its hot</strong>,
      data: 'edge with a React.Node label',
    },
    { from: '1', to: '2', data: 'edge sans label' },
    { from: '2', to: 33, isBidirectional: true, data: 'A bidirection edge' },
  ],
};

export const colored = {
  vertices: [
    { key: 'key 0', data: 'red' },
    {
      key: '1',
      label: 'Key is the number 1',
      data: 'blue',
    },
    { key: '2', label: <h3>OMG an H3</h3>, data: 'green' },
    { key: '33', data: 'teal' },
  ],
  edges: [
    { from: 'key 0', to: '1', label: 'The Great Edge Label', data: '#c00' },
    {
      from: 'key 0',
      to: '2',
      label: <strong>Drop it like its hot</strong>,
      data: '#0c0',
    },
    { from: '1', to: '2', data: '#00c' },
    { from: '2', to: '33', isBidirectional: true, data: '#c0c' },
  ],
};

export function getColorNodeLabel(vertex) {
  let { label } = vertex;
  label = label == null ? String(vertex.key) : label;
  if (typeof label !== 'string' && !React.isValidElement(label)) {
    label = String(label);
  }
  return <span style={{ color: vertex.data }}>{label}</span>;
}

export function setOnColorNode(vertex) {
  const style = { border: `1px solid ${vertex.data}` };
  return { style };
}
export function setOnColorEdge(edge) {
  return { stroke: edge.data };
}
