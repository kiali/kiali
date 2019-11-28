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

import React, { Component } from 'react';
import { InteractiveForceGraph, ForceGraphNode } from 'react-vis-force';
import { window } from 'global';
import { debounce } from 'lodash';
import ForceGraphArrowLink from './ForceGraphArrowLink';

import { nodesPropTypes, linksPropTypes } from '../../propTypes/dependencies';

// export for tests
export const chargeStrength = ({ radius = 5, orphan }) => (orphan ? -20 * radius : -12 * radius);

export default class DependencyForceGraph extends Component {
  static propTypes = {
    nodes: nodesPropTypes.isRequired,
    links: linksPropTypes.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  componentWillMount() {
    this.onResize();
    this.debouncedResize = debounce((...args) => this.onResize(...args), 50);
    window.addEventListener('resize', this.debouncedResize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.debouncedResize);
  }

  onResize() {
    const width = window.innerWidth;
    let height = window.innerHeight;
    if (this.container) {
      height -= this.container.offsetTop;
    }

    this.setState({ width, height });
  }

  render() {
    const { nodes, links } = this.props;
    const { width, height } = this.state;
    const nodesMap = new Map(nodes.map(node => [node.id, node]));

    return (
      <div
        ref={
          /* istanbul ignore next */ c => {
            this.container = c;
          }
        }
        style={{ position: 'relative' }}
      >
        <InteractiveForceGraph
          zoom
          minScale={1 / 2}
          maxScale={4}
          panLimit={2}
          simulationOptions={{
            width,
            height,
            strength: {
              charge: chargeStrength,
              x: width / height > 1 ? 0.1 : 0.12,
              y: width / height < 1 ? 0.1 : 0.12,
            },
          }}
          labelOffset={{
            x: ({ radius }) => radius + 2,
            y: ({ radius }) => radius / 2,
          }}
          nodeAttrs={['orphan']}
          highlightDependencies
        >
          {nodes.map(({ labelStyle, labelClass, showLabel, opacity, fill, ...node }) => (
            <ForceGraphNode
              key={node.id}
              node={node}
              labelStyle={labelStyle}
              labelClass={labelClass}
              showLabel={showLabel}
              opacity={opacity}
              fill={fill}
            />
          ))}
          {links.map(({ opacity, ...link }) => (
            <ForceGraphArrowLink
              key={`${link.source}=>${link.target}`}
              opacity={opacity}
              link={link}
              targetRadius={nodesMap.get(link.target).radius}
            />
          ))}
        </InteractiveForceGraph>
      </div>
    );
  }
}
