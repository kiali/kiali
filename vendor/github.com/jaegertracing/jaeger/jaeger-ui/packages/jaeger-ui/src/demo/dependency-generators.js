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

import Chance from 'chance';

const chance = new Chance();

export default chance.mixin({
  dependencies({ numOfNodes = 45, numOfLinks = 45 }) {
    return chance.n(chance.linkFromNodes, numOfLinks, {
      nodeList: chance.n(chance.node, numOfNodes),
    });
  },

  node() {
    return chance.city();
  },

  link({
    parent = chance.city(),
    child = chance.city(),
    callCount = chance.integer({ min: 1, max: 250000000 }),
  }) {
    return { parent, child, callCount };
  },

  linkFromNodes({ nodeList }) {
    return chance.link({
      parent: chance.pickone(nodeList),
      child: chance.pickone(nodeList),
    });
  },
});
