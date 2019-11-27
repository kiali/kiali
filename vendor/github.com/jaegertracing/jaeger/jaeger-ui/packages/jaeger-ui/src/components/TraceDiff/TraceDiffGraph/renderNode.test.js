// Copyright (c) 2019 The Jaeger Authors.
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

import React from 'react';
import { shallow } from 'enzyme';

import renderNode, { DiffNode } from './renderNode';

describe('drawNode', () => {
  const operation = 'operationName';
  const service = 'serviceName';

  describe('diffNode', () => {
    const defaultCount = 100;
    const props = {
      a: defaultCount,
      b: defaultCount,
      operation,
      service,
    };

    let wrapper;

    beforeEach(() => {
      wrapper = shallow(<DiffNode {...props} />);
    });

    it('renders as expected when props.a and props.b are the same', () => {
      expect(wrapper).toMatchSnapshot();
    });

    it('renders as expected when props.a is less than props.b', () => {
      wrapper.setProps({ a: defaultCount / 2 });
      expect(wrapper).toMatchSnapshot();
    });

    it('renders as expected when props.a is more than props.b', () => {
      wrapper.setProps({ a: defaultCount * 2 });
      expect(wrapper).toMatchSnapshot();
    });

    it('renders as expected when props.a is 0', () => {
      wrapper.setProps({ a: 0 });
      expect(wrapper).toMatchSnapshot();
    });

    it('renders as expected when props.b is 0', () => {
      wrapper.setProps({ b: 0 });
      expect(wrapper).toMatchSnapshot();
    });

    it('renders as expected when props.isUiFindMatch is true', () => {
      wrapper.setProps({ isUiFindMatch: true });
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('renderNode()', () => {
    const dataKey = 'data-key';
    const dataValue = 'data-value';
    const key = 'vertex key';
    const vertex = {
      data: {
        data: {
          [dataKey]: dataValue,
        },
        operation,
        service,
      },
      key,
    };

    it('extracts values from vertex.data', () => {
      const node = renderNode(vertex);
      expect(node.props[dataKey]).toBe(dataValue);
      expect(node.props.operation).toBe(operation);
      expect(node.props.service).toBe(service);
    });
  });
});
