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

import PropTypes from 'prop-types';
import React from 'react';
import cytoscape from 'cytoscape';
import cydagre from 'cytoscape-dagre';
import dagre from 'dagre';

cydagre(cytoscape, dagre);

export default class DAG extends React.Component {
  static propTypes = {
    serviceCalls: PropTypes.arrayOf(
      PropTypes.shape({
        parent: PropTypes.string,
        child: PropTypes.string,
        callCount: PropTypes.number,
      })
    ),
  };

  static defaultProps = {
    serviceCalls: [],
  };

  componentDidMount() {
    const { serviceCalls } = this.props;
    const nodeMap = {};
    const nodes = [];
    const edges = [];
    serviceCalls.forEach(d => {
      if (!nodeMap[d.parent]) {
        nodes.push({ data: { id: d.parent } });
        nodeMap[d.parent] = true;
      }
      if (!nodeMap[d.child]) {
        nodes.push({ data: { id: d.child } });
        nodeMap[d.child] = true;
      }
      edges.push({
        data: { source: d.parent, target: d.child, label: `${d.callCount}` },
      });
    });
    cytoscape({
      container: document.getElementById('cy'),
      boxSelectionEnabled: false,
      autounselectify: true,
      layout: {
        name: 'dagre',
      },
      minZoom: 0.5,
      style: [
        {
          selector: 'node',
          style: {
            content: 'data(id)',
            'text-opacity': 0.5,
            'text-valign': 'center',
            'text-halign': 'right',
            'background-color': '#11939A',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 4,
            label: 'data(label)',
            'target-arrow-shape': 'triangle',
            'line-color': 'gray',
            'target-arrow-color': 'gray',
            'curve-style': 'bezier',
          },
        },
      ],
      elements: {
        nodes,
        edges,
      },
    });
  }

  render() {
    return (
      <div
        id="cy"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          left: 0,
          top: 0,
        }}
      />
    );
  }
}
