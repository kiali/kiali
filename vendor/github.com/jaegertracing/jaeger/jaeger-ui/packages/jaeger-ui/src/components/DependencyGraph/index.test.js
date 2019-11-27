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
import { Tabs } from 'antd';
import { shallow } from 'enzyme';

import DAG from './DAG';
import DependencyForceGraph from './DependencyForceGraph';
import {
  DependencyGraphPageImpl as DependencyGraph,
  GRAPH_TYPES,
  mapDispatchToProps,
  mapStateToProps,
} from './index';
import LoadingIndicator from '../common/LoadingIndicator';

const childId = 'boomya';
const parentId = 'elder-one';
const callCount = 1;
const dependencies = [
  {
    callCount,
    child: childId,
    parent: parentId,
  },
];
const state = {
  dependencies: {
    dependencies,
    error: null,
    loading: false,
  },
};

const props = mapStateToProps(state);

describe('<DependencyGraph>', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<DependencyGraph {...props} fetchDependencies={() => {}} />);
  });

  it('does not explode', () => {
    expect(wrapper.length).toBe(1);
  });

  it('shows a loading indicator when loading data', () => {
    expect(wrapper.find(LoadingIndicator).length).toBe(0);
    wrapper.setProps({ loading: true });
    expect(wrapper.find(LoadingIndicator).length).toBe(1);
  });

  it('shows an error message when passed error information', () => {
    const error = {};
    expect(wrapper.find({ error: expect.anything() }).length).toBe(0);
    wrapper.setProps({ error });
    expect(wrapper.find({ error }).length).toBe(1);
  });

  it('shows a message where there is nothing to visualize', () => {
    wrapper.setProps({ links: null, nodes: null });
    const matchTest = expect.stringMatching(/no.*?found/i);
    expect(wrapper.text()).toEqual(matchTest);
  });

  describe('graph types', () => {
    it('renders a menu with options for the graph types', () => {
      expect(wrapper.find(Tabs.TabPane).length).toBe(Object.keys(GRAPH_TYPES).length);
      expect(wrapper.find({ tab: GRAPH_TYPES.FORCE_DIRECTED.name }).length).toBe(1);
      expect(wrapper.find({ tab: GRAPH_TYPES.DAG.name }).length).toBe(1);
    });

    it('renders a force graph when FORCE_GRAPH is the selected type', () => {
      wrapper.simulate('change', GRAPH_TYPES.FORCE_DIRECTED.type);
      expect(wrapper.state('graphType')).toBe(GRAPH_TYPES.FORCE_DIRECTED.type);
      expect(wrapper.find(DependencyForceGraph).length).toBe(1);
    });

    it('renders a DAG graph when DAG is the selected type', () => {
      wrapper.simulate('change', GRAPH_TYPES.DAG.type);
      expect(wrapper.state('graphType')).toBe(GRAPH_TYPES.DAG.type);
      expect(wrapper.find(DAG).length).toBe(1);
    });
  });
});

describe('mapStateToProps()', () => {
  it('refines state to generate the props', () => {
    expect(mapStateToProps(state)).toEqual({
      ...state.dependencies,
      nodes: [
        expect.objectContaining({ callCount, orphan: false, id: parentId, radius: 3 }),
        expect.objectContaining({ callCount, orphan: false, id: childId, radius: 3 }),
      ],
      links: [{ callCount, source: parentId, target: childId, value: 1, target_node_size: 3 }],
    });
  });
});

describe('mapDispatchToProps()', () => {
  it('providers the `fetchDependencies` prop', () => {
    expect(mapDispatchToProps({})).toEqual({ fetchDependencies: expect.any(Function) });
  });
});
