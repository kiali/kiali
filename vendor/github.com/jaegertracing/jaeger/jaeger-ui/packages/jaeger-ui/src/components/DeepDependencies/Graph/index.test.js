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
import { shallow } from 'enzyme';
import { Digraph, LayoutManager } from '@jaegertracing/plexus';

import Graph, { setOnEdgesContainer, setOnVectorBorderContainerWithViewModifiers } from './index';

import { EViewModifier } from '../../../model/ddg/types';

describe('<Graph />', () => {
  const vertices = [...new Array(10)].map((_, i) => ({ key: `key${i}` }));
  const edges = [
    {
      from: vertices[0].key,
      to: vertices[1].key,
    },
    {
      from: vertices[1].key,
      to: vertices[2].key,
    },
  ];

  const props = {
    edges,
    edgesViewModifiers: new Map(),
    vertices,
    verticesViewModifiers: new Map(),
  };

  describe('constructor', () => {
    it('creates layout manager', () => {
      const graph = new Graph(props);
      expect(graph.layoutManager instanceof LayoutManager).toBe(true);
    });
  });

  describe('render', () => {
    let wrapper;
    let plexusGraph;

    beforeEach(() => {
      wrapper = shallow(<Graph {...props} />);
      plexusGraph = wrapper.find(Digraph);
    });

    it('renders provided edges and vertices', () => {
      expect(plexusGraph.prop('edges')).toEqual(edges);
      expect(plexusGraph.prop('vertices')).toEqual(vertices);
      expect(wrapper).toMatchSnapshot();
    });

    it('de-emphasizes non-matching edges iff edgeVMs are present', () => {
      expect(plexusGraph.prop('layers')[3].setOnContainer).toBe(setOnEdgesContainer.withoutViewModifiers);

      wrapper.setProps({ edgesViewModifiers: new Map([[0, EViewModifier.Emphasized]]) });
      plexusGraph = wrapper.find(Digraph);
      expect(plexusGraph.prop('layers')[3].setOnContainer).toBe(setOnEdgesContainer.withViewModifiers);
    });

    it('de-emphasizes non-matching vertices iff vertexVMs are present', () => {
      expect(plexusGraph.prop('layers')[2].setOnContainer).toBe(
        Digraph.propsFactories.scaleStrokeOpacityStrongest
      );

      wrapper.setProps({ verticesViewModifiers: new Map([[0, EViewModifier.Emphasized]]) });
      plexusGraph = wrapper.find(Digraph);
      expect(plexusGraph.prop('layers')[2].setOnContainer).toBe(setOnVectorBorderContainerWithViewModifiers);
    });
  });

  describe('clean up', () => {
    it('stops LayoutManager before unmounting', () => {
      const wrapper = shallow(<Graph {...props} />);
      const stopAndReleaseSpy = jest.spyOn(wrapper.instance().layoutManager, 'stopAndRelease');
      wrapper.unmount();
      expect(stopAndReleaseSpy).toHaveBeenCalledTimes(1);
    });
  });
});
