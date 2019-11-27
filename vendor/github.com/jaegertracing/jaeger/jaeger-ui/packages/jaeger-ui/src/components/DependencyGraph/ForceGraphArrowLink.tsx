// Copyright (c) 2019 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import * as React from 'react';
import { ForceGraphLink } from 'react-vis-force';

type TLink = {
  source: string | { id: string };
  target: string | { id: string };
  value: number;
};

type TProps = {
  className?: string;
  color?: string;
  edgeOffset?: number;
  link: TLink;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
  targetRadius?: number;
};

function linkId(link: TLink) {
  const { source, target } = link;
  const srcId = typeof source === 'string' ? source : source.id;
  const targetId = typeof target === 'string' ? target : target.id;
  return `${srcId}=>${targetId}`;
}

export default class ForceGraphArrowLink extends React.PureComponent<TProps> {
  static defaultProps = {
    className: '',
    edgeOffset: 2,
    opacity: 0.6,
    stroke: '#999',
    strokeWidth: 1,
    targetRadius: 2,
  };

  render() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { link, targetRadius, edgeOffset: _, ...spreadable } = this.props;
    const id = `arrow-${linkId(link)}`;
    return (
      <g>
        <defs>
          <marker
            id={id}
            markerWidth={6}
            markerHeight={4}
            refX={5 + (targetRadius || 0)}
            refY={2}
            orient="auto"
            markerUnits="strokeWidth"
          >
            {Number(targetRadius) > 0 && (
              <path d="M0,0 L0,4 L6,2 z" fill={spreadable.stroke || spreadable.color} />
            )}
          </marker>
        </defs>

        <ForceGraphLink {...spreadable} link={link} markerEnd={`url(#${id})`} />
      </g>
    );
  }
}
