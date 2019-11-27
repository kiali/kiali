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

import React from 'react';
import { shallow } from 'enzyme';

import ForceGraphArrowLink from './ForceGraphArrowLink';

const defaultProps = {
  link: {
    source: 'a',
    target: 'b',
    value: 5,
  },
};

describe('<ForceGraphArrowLink />', () => {
  it('should a standard size of the arrow', () => {
    const wrapper = shallow(
      <ForceGraphArrowLink {...defaultProps} link={{ ...defaultProps.link, value: 9 }} />
    );

    const marker = wrapper
      .find('g')
      .first()
      .find('defs')
      .first()
      .find('marker');
    expect(marker.prop('markerWidth')).toEqual(6);
    expect(marker.prop('markerHeight')).toEqual(4);
    expect(marker.prop('markerUnits')).toEqual('strokeWidth');
  });

  it('should not have arrow overlapping with target node', () => {
    const wrapper = shallow(
      <ForceGraphArrowLink {...defaultProps} link={{ ...defaultProps.link, value: 9 }} targetRadius={2} />
    );

    const marker = wrapper
      .find('g')
      .first()
      .find('defs')
      .first()
      .find('marker');
    expect(marker.prop('refX')).toEqual(2 + 5);
  });

  it('should have an id with the name of source and target', () => {
    const testLink = { source: 's_node', target: 't_node', value: 10 };

    const wrapper = shallow(<ForceGraphArrowLink {...defaultProps} link={testLink} />);
    const marker = wrapper
      .find('g')
      .first()
      .find('defs')
      .first()
      .find('marker');
    expect(marker.prop('id')).toEqual('arrow-s_node=>t_node');
  });
});
