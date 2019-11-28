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

export const simplePayloadElemMaker = label => ({
  operation: `${label}Operation`,
  service: `${label}Service`,
});

export const focalPayloadElem = simplePayloadElemMaker('focal');

const sameFocalServicePayloadElem = {
  operation: `not-${focalPayloadElem.operation}`,
  service: focalPayloadElem.service,
};

const pathLengthener = path => {
  const prequels = [];
  const sequels = [];
  path.forEach(({ operation, service }) => {
    if (operation !== focalPayloadElem.operation && service !== focalPayloadElem.service) {
      prequels.push({
        operation: `prequel-${operation}`,
        service,
      });
      sequels.push({
        operation,
        service: `sequel-${service}`,
      });
    }
  });
  return [...prequels, ...path, ...sequels];
};

export const firstPayloadElem = simplePayloadElemMaker('first');
export const beforePayloadElem = simplePayloadElemMaker('before');
export const midPayloadElem = simplePayloadElemMaker('mid');
export const afterPayloadElem = simplePayloadElemMaker('after');
export const lastPayloadElem = simplePayloadElemMaker('last');

export const shortPath = [beforePayloadElem, focalPayloadElem];
export const simplePath = [
  firstPayloadElem,
  beforePayloadElem,
  focalPayloadElem,
  afterPayloadElem,
  lastPayloadElem,
];
export const longSimplePath = pathLengthener(simplePath);
export const noFocalPath = [
  firstPayloadElem,
  beforePayloadElem,
  midPayloadElem,
  afterPayloadElem,
  lastPayloadElem,
];
export const doubleFocalPath = [
  firstPayloadElem,
  beforePayloadElem,
  focalPayloadElem,
  midPayloadElem,
  focalPayloadElem,
  afterPayloadElem,
  lastPayloadElem,
];
export const almostDoubleFocalPath = [
  firstPayloadElem,
  beforePayloadElem,
  sameFocalServicePayloadElem,
  midPayloadElem,
  focalPayloadElem,
  afterPayloadElem,
  lastPayloadElem,
];

const divergentPayloadElem = simplePayloadElemMaker('divergentPayloadElem');
export const convergentPaths = [
  [firstPayloadElem, focalPayloadElem, midPayloadElem, afterPayloadElem, lastPayloadElem],
  [firstPayloadElem, focalPayloadElem, divergentPayloadElem, afterPayloadElem, lastPayloadElem],
];

export const wrap = paths => ({
  dependencies: paths.map(path => ({ path, attributes: [] })),
});
