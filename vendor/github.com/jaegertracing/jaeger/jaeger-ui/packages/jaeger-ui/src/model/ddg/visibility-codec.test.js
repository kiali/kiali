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

import { encode, decode, encodeDistance } from './visibility-codec';
import { focalPayloadElem, longSimplePath, shortPath, simplePath, wrap } from './sample-paths.test.resources';
import transformDdgData from './transformDdgData';

describe('visibility-codec', () => {
  const sampleLargestDecoded = [...new Array(31)].map((_undef, i) => i);
  const sampleLargestEncoded = 'zik0zj';
  const sampleRepeatedDecoded = [0, 1, 31, 32, 124, 156, 187];
  const sampleRepeatedEncoded = '3~2.~2.1.2~2';

  describe('encode', () => {
    it('converts numbers into encoded string', () => {
      expect(encode([0, 1])).toBe('3');
    });

    it('converts numbers greater than 30 into encoded string', () => {
      expect(encode([0, 1, 31])).toBe('3.1');
    });

    it('leaves empty psv entries', () => {
      expect(encode([0, 1, 31, 93])).toBe('3.1..1');
    });

    it('creates largest possible value in psv', () => {
      expect(encode(sampleLargestDecoded)).toBe(sampleLargestEncoded);
    });

    it('creates psv with repeated values', () => {
      expect(encode(sampleRepeatedDecoded)).toBe(sampleRepeatedEncoded);
    });
  });

  describe('decode', () => {
    it('converts encoded string into numbers', () => {
      expect(decode('3')).toEqual([0, 1]);
    });

    it('converts encoded string with commas into numbers greater than 31', () => {
      expect(decode('3.1')).toEqual([0, 1, 31]);
    });

    it('handles empty psv entries', () => {
      expect(decode('3.1..1')).toEqual([0, 1, 31, 93]);
    });

    it('handles largest possible value in psv', () => {
      expect(decode(sampleLargestEncoded)).toEqual(sampleLargestDecoded);
    });

    it('parses psv with repeated values', () => {
      expect(decode(sampleRepeatedEncoded).sort((a, b) => a - b)).toEqual(sampleRepeatedDecoded);
    });
  });

  describe('encodeDistance', () => {
    const ddgModel = transformDdgData(wrap([longSimplePath, simplePath]), focalPayloadElem);
    const shortModel = transformDdgData(wrap([shortPath]), focalPayloadElem);

    /**
     * Creates a visibility encoding containing all indices between two specified hops, inclusive, except
     * those specified as omitted.
     *
     * @param {number} start - The lowest hop that is expected, should be less than or equal to 0.
     * @param {number} end - The largest hop that is expected, should be greater than or equal to 0.
     * @param {Set<number>} [omit] - Indices between start and end that should not be encoded, used for
     *     testing partially full hops.
     * @returns {string} - The expected encoding.
     */
    function expectedEncoding(start, end, omit) {
      const expectedIndices = [];
      for (let i = start; i <= end; i++) {
        expectedIndices.push(
          ...ddgModel.distanceToPathElems
            .get(i)
            .map(({ visibilityIdx }) => visibilityIdx)
            .filter(idx => !omit || !omit.has(idx))
        );
      }
      return encode(expectedIndices);
    }

    describe('without visEncoding', () => {
      it('removes hops when selecting less than 2 hops', () => {
        const encoding = encodeDistance({
          distance: -1,
          direction: -1,
          ddgModel,
        });
        expect(encoding).toBe(expectedEncoding(-1, 2));
      });

      it('adds hops when selecting more than 2 hops', () => {
        const encoding = encodeDistance({
          distance: 4,
          direction: 1,
          ddgModel,
        });
        expect(encoding).toBe(expectedEncoding(-2, 4));
      });

      it('handles selecting 0', () => {
        const upstreamEncoding = encodeDistance({
          distance: 0,
          direction: 1,
          ddgModel,
        });
        expect(upstreamEncoding).toBe(expectedEncoding(-2, 0));

        const downstreamEncoding = encodeDistance({
          distance: 0,
          direction: -1,
          ddgModel,
        });
        expect(downstreamEncoding).toBe(expectedEncoding(0, 2));
      });

      it('handles DDGs smaller than two hops', () => {
        const encoding = encodeDistance({
          distance: 0,
          direction: -1,
          ddgModel: shortModel,
        });
        expect(encoding).toEqual('1');
      });

      it('handles out of bounds selection', () => {
        const encoding = encodeDistance({
          distance: 8,
          direction: 1,
          ddgModel,
        });
        expect(encoding).toBe(expectedEncoding(-2, 6));
      });
    });

    describe('with visEncoding', () => {
      // All indices wthin four hops
      const fourHops = encode([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
      // All indices within three hops, except two. One with a distance of -2, one with a distance of 2
      const partialHops = encode([0, 1, 2, 3, 4, 5, 7, 9, 10, 11]);

      it('adds hops when selecting more hops', () => {
        const encoding = encodeDistance({
          distance: 6,
          direction: 1,
          ddgModel,
          prevVisEncoding: fourHops,
        });
        expect(encoding).toBe(expectedEncoding(-4, 6));
      });

      it('removes hops when selecting fewer hops', () => {
        const encoding = encodeDistance({
          distance: -2,
          direction: -1,
          ddgModel,
          prevVisEncoding: fourHops,
        });
        expect(encoding).toBe(expectedEncoding(-2, 4));
      });

      it('handles partially full hops', () => {
        const encoding = encodeDistance({
          distance: 4,
          direction: 1,
          ddgModel,
          prevVisEncoding: partialHops,
        });
        expect(encoding).toBe(expectedEncoding(-3, 4, new Set([8])));
      });

      it('handles selecting 0', () => {
        const upstreamEncoding = encodeDistance({
          distance: 0,
          direction: 1,
          ddgModel,
          prevVisEncoding: partialHops,
        });
        expect(upstreamEncoding).toBe(expectedEncoding(-3, 0, new Set([8])));

        const downstreamEncoding = encodeDistance({
          distance: 0,
          direction: -1,
          ddgModel,
          prevVisEncoding: partialHops,
        });
        expect(downstreamEncoding).toBe(expectedEncoding(0, 3, new Set([6])));
      });
    });

    describe('error handling', () => {
      it('throws if distance and direction are opposite', () => {
        expect(() =>
          encodeDistance({
            distance: 1,
            direction: -1,
            ddgModel,
          })
        ).toThrowError();
      });
    });
  });
});
