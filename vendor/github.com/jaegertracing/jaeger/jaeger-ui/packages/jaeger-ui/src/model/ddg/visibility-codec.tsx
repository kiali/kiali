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

/* eslint-disable no-bitwise */

import memoize from 'lru-memoize';

import { EDirection, TDdgModel } from './types';

const COUNT_INDICATOR = '~';
const DELIMITER = '.';
// This bucket size was chosen as JavaScript uses 32-bit numbers for bitwise operators, so the maximum number
// of indices that can be tracked in a single number is 32. Increasing from 31 visibility values per base36
// number to 32 visibility values would require an additional base36 character, which reduces the efficiency.
// For more info: https://repl.it/repls/IllfatedMaroonObservation
const VISIBILITY_BUCKET_SIZE = 31;

/*
 * Converts string csv of base36 numbers into array of visible indices.
 *
 * @param {string} encoded - base36 csv visibility encoding.
 * @returns {number[]} - Visible indices for this encoding.
 */
export const decode: (encoded: string) => number[] = memoize(10)((encoded: string): number[] => {
  const rv: number[] = [];
  let i = 0;
  encoded.split(DELIMITER).forEach(tupleStr => {
    const [partial, c = '1'] = tupleStr.split(COUNT_INDICATOR);
    const count = parseInt(c, 36);
    const partialAsNumber = partial ? parseInt(partial, 36) : 0;
    // Because JavaScript bitwise operators wrap when exceeding 32 bits, the second check is necessary to
    // prevent an infinite loop if (partialAsNuber & i << 31) is truthy.
    for (let j = 0; partialAsNumber >= 1 << j && j < VISIBILITY_BUCKET_SIZE; j += 1) {
      if ((1 << j) & partialAsNumber) {
        for (let k = 0; k < count; k += 1) {
          rv.push((i + k) * VISIBILITY_BUCKET_SIZE + j);
        }
      }
    }
    i += count;
  });
  return rv;
});

/*
 * Given a visibility index, returns the index of the bucket that contains the given index and the power of
 * two that would reflect the given index being visible, relative to the bucket it resides in.
 *
 * @param {number} visibilityIdx - An index within the visibility key
 * @returns {object} - Two numbers relating to the given number.
 *     bucketIdx - Index of the JavaScript number in getBuckets that contains the visibility data for the
 *         given index.
 *     visibilityValue - A power of two that can be used with getBuckets(key)[bucketIdx] to determine if the
 *         given index is visible, or to change its visibility.
 */
function convertAbsoluteIdxToRelativeValues(absIdx: number) {
  const csvIdx = Math.floor(absIdx / VISIBILITY_BUCKET_SIZE);
  const relativeIdx = absIdx % VISIBILITY_BUCKET_SIZE;
  const visibilityValue = 1 << relativeIdx;
  return { csvIdx, visibilityValue };
}

/*
 * Converts array of visible indices into string csv of base36 numbers.
 *
 * @param {number[]} decoded - Visible indices for this encoding.
 * @returns {string} - base36 csv visibility encoding.
 */
export const encode = (decoded: number[]): string => {
  const partials: number[] = [];
  decoded.forEach(visIdx => {
    const { csvIdx, visibilityValue } = convertAbsoluteIdxToRelativeValues(visIdx);
    partials[csvIdx] |= visibilityValue;
  });

  const condensed: [number, number][] = [];
  // for loop is necessary instead of forEach as partials can contain `empty`
  for (let i = 0; i < partials.length; i++) {
    const partial = partials[i];
    const tuple = condensed[condensed.length - 1];
    if (!tuple || tuple[0] !== partial) {
      condensed.push([partial, 1]);
    } else {
      tuple[1] += 1;
    }
  }

  return condensed
    .map(([partial, count]) => {
      const encoded = partial ? partial.toString(36) : '';
      const suffix = count !== 1 ? `${COUNT_INDICATOR}${count.toString(36)}` : '';
      return `${encoded}${suffix}`;
    })
    .join(DELIMITER);
};

/**
 * Creates a string csv of base36 such that all indices between 0 and the distance, inclusive, are visible,
 * and all other indices in that direction are hidden. Indices in the opposite direction are unchanged.
 *
 * @param {Object} kwarg - Object containing arguments to encodeDistance.
 * @param {TDdgModel} kwarg.ddgModel - Model used to determine which indices exist at difference distances.
 * @param {EDirection} kwarg.direction - Direction of affected indices.
 * @param {number} kwarg.distance - Range of indices to include.
 * @param {string} [kwarg.prevVisEncoding] - Previous visibility encoding. Encoded indices opposite of
 *     affected direction will persist in new encoding. If absent, two hops is the default to preserve.
 * @returns {string} - New base36 csv visibility encoding.
 */
export const encodeDistance = ({
  ddgModel,
  direction,
  distance,
  prevVisEncoding,
}: {
  ddgModel: TDdgModel;
  direction: EDirection;
  distance: number;
  prevVisEncoding?: string;
}): string => {
  if (Math.sign(distance) === -1 * Math.sign(direction)) {
    throw new Error(`Distance (${distance}) and direction (${direction}) cannot have opposite signs`);
  }

  const { distanceToPathElems, visIdxToPathElem } = ddgModel;

  let nextVisible: number[];
  if (prevVisEncoding) {
    nextVisible = decode(prevVisEncoding).filter(
      idx => visIdxToPathElem[idx] && Math.sign(visIdxToPathElem[idx].distance) !== direction
    );
  } else {
    nextVisible = [
      ...(distanceToPathElems.get(-1 * direction) || []),
      ...(distanceToPathElems.get(-2 * direction) || []),
    ].map(({ visibilityIdx }) => visibilityIdx);
  }

  for (let i = 0; i !== distance + direction; i += direction) {
    const elems = distanceToPathElems.get(i);
    if (elems) {
      nextVisible.push(...elems.map(({ visibilityIdx }) => visibilityIdx));
    }
  }

  return encode(nextVisible);
};
