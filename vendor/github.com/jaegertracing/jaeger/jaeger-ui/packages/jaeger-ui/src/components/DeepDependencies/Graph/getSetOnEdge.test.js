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

import getSetOnEdge, { baseCase, matchMiss } from './getSetOnEdge';

import { getEdgeId } from '../../../model/ddg/GraphModel';
import { EViewModifier } from '../../../model/ddg/types';

describe('getSetOnEdge', () => {
  const makeEdge = (from, to) => ({
    edge: { from, to },
  });
  const hovered = makeEdge('test', 'hovered');
  const notHovered = makeEdge('not', 'hovered');
  const miss = makeEdge('test', 'miss');
  const vms = new Map([
    [getEdgeId(hovered.edge.from, hovered.edge.to), EViewModifier.PathHovered],
    [getEdgeId(notHovered.edge.from, notHovered.edge.to), EViewModifier.emphasized],
  ]);
  const fakeUtils = {
    getGlobalId: id => id,
  };

  it('returns base case when given empty map', () => {
    expect(getSetOnEdge(new Map())).toBe(baseCase);
  });

  it('returns function that returns miss if id is not in map as hovered', () => {
    const setOnEdge = getSetOnEdge(vms);

    expect(setOnEdge(miss, fakeUtils)).toBe(matchMiss);
    expect(setOnEdge(notHovered, fakeUtils)).toBe(matchMiss);
  });

  it('returns function that returns hovered edge class and hovered arrow if id is in map as hovered', () => {
    const setOnEdge = getSetOnEdge(vms);

    expect(setOnEdge(hovered, fakeUtils)).toEqual({
      className: expect.stringContaining('Hovered'),
      markerEnd: expect.stringContaining('hovered'),
    });
  });
});
