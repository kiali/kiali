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

import React from 'react';
import { shallow } from 'enzyme';
import { InteractiveForceGraph, ForceGraphNode } from 'react-vis-force';

import DependencyForceGraph, { chargeStrength } from './DependencyForceGraph';
import ForceGraphArrowLink from './ForceGraphArrowLink';

describe('chargeStrength', () => {
  it('returns a number', () => {
    expect(chargeStrength({ radius: 1, orphan: false })).toBeLessThan(0);
  });

  it('handles orphan as a special case', () => {
    const asOrphan = chargeStrength({ radius: 1, orphan: true });
    const notOrphan = chargeStrength({ radius: 1, orphan: false });
    expect(chargeStrength(asOrphan)).toBeLessThan(0);
    expect(chargeStrength(notOrphan)).toBeLessThan(0);
    expect(asOrphan).not.toBe(notOrphan);
  });
});

describe('<DependencyForceGraph>', () => {
  const nodes = [{ id: 'node-a', radius: 1 }, { id: 'node-b', radius: 1 }];
  const links = [{ source: 'node-a', target: 'node-b', value: 1 }];
  let oldSize;
  let wrapper;

  beforeAll(() => {
    oldSize = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });

  afterAll(() => {
    const { height, width } = oldSize;
    window.innerHeight = height;
    window.innerWidth = width;
  });

  beforeEach(() => {
    window.innerWidth = 1234;
    window.innerHeight = 5678;
    wrapper = shallow(<DependencyForceGraph nodes={nodes} links={links} />);
  });

  it('does not explode', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper.length).toBe(1);
  });

  it('saves the window dimensions to state', () => {
    const { height, width } = wrapper.state();
    expect(height).toBe(window.innerHeight);
    expect(width).toBe(window.innerWidth);
  });

  describe('window resize event', () => {
    it('adds and removes an event listener on mount and unmount', () => {
      const oldFns = {
        addFn: window.addEventListener,
        removeFn: window.removeEventListener,
      };
      window.addEventListener = jest.fn();
      window.removeEventListener = jest.fn();
      wrapper = shallow(<DependencyForceGraph nodes={nodes} links={links} />);
      expect(window.addEventListener.mock.calls.length).toBe(1);
      expect(window.removeEventListener.mock.calls.length).toBe(0);
      wrapper.unmount();
      expect(window.removeEventListener.mock.calls.length).toBe(1);
      window.addEventListener = oldFns.addFn;
      window.removeEventListener = oldFns.removeFn;
    });

    it('updates the saved window dimensions on resize', () => {
      const { height: preHeight, width: preWidth } = wrapper.state();
      window.innerHeight *= 2;
      window.innerWidth *= 2;
      // difficult to get JSDom to dispatch the window resize event, so hit
      // the listener directly
      wrapper.instance().onResize();
      const { height, width } = wrapper.state();
      expect(height).toBe(window.innerHeight);
      expect(width).toBe(window.innerWidth);
      expect(height).not.toBe(preHeight);
      expect(width).not.toBe(preWidth);
    });
  });

  describe('render', () => {
    it('renders a InteractiveForceGraph', () => {
      expect(wrapper.find(InteractiveForceGraph).length).toBe(1);
    });

    it('renders a <ForceGraphNode> for each node', () => {
      expect(wrapper.find(ForceGraphNode).length).toBe(nodes.length);
    });

    it('renders a <ForceGraphArrowLink> for each link', () => {
      expect(wrapper.find(ForceGraphArrowLink).length).toBe(links.length);
    });
  });
});
