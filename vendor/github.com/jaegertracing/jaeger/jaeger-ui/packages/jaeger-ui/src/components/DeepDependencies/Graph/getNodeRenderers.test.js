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

import { shallow } from 'enzyme';

import getNodeRenderers from './getNodeRenderers';

import { EViewModifier } from '../../../model/ddg/types';

describe('getNodeRenderers', () => {
  const key = 'test vertex key';
  const lv = {
    vertex: {
      key,
    },
    height: 200,
    width: 100,
  };
  const focalLv = { ...lv, vertex: { key, isFocalNode: true } };

  describe('vectorBorder', () => {
    // Short, DRY way to calculate with (w/) versus (v) without (w/o)
    const wvwo = someBoolean => (someBoolean ? 'with' : 'without');

    [true, false].forEach(findMatch => {
      [true, false].forEach(hovered => {
        [true, false].forEach(pathHovered => {
          [true, false].forEach(focalNode => {
            it(`returns circle ${wvwo(findMatch)} .is-findMatch,\t${wvwo(hovered)} .is-hovered,\t${wvwo(
              pathHovered
            )} .is-pathHovered,\tand ${wvwo(focalNode)} .is-focalNode`, () => {
              const testLv = focalNode ? focalLv : lv;
              const findMatches = new Set(findMatch ? [testLv.vertex] : undefined);
              const vm =
                // eslint-disable-next-line no-bitwise
                (hovered ? EViewModifier.Hovered : 0) | (pathHovered ? EViewModifier.PathHovered : 0);
              const vms = new Map([[key, vm]]);
              expect(shallow(getNodeRenderers(findMatches, vms).vectorBorder(testLv))).toMatchSnapshot();
            });
          });
        });
      });
    });
  });

  describe('htmlEmphasis', () => {
    it('returns null if vertex is neither a findMatch nor focalNode', () => {
      expect(getNodeRenderers(new Set(), new Map()).htmlEmphasis(lv)).toBe(null);
    });

    it('returns div with .is-findMatch if vertex is a findMatch', () => {
      const wrapper = shallow(getNodeRenderers(new Set([lv.vertex]), new Map()).htmlEmphasis(lv));
      expect(wrapper.hasClass('is-findMatch')).toBe(true);
      expect(wrapper.type()).toBe('div');
    });

    it('returns div with .is-focalNode if vertex is a focalNode', () => {
      const wrapper = shallow(getNodeRenderers(new Set(), new Map()).htmlEmphasis(focalLv));
      expect(wrapper.hasClass('is-focalNode')).toBe(true);
      expect(wrapper.type()).toBe('div');
    });

    it('returns div with .is-findMatch and .is-focalNode if vertex is a focalNode and a findMatch', () => {
      const wrapper = shallow(getNodeRenderers(new Set([focalLv.vertex]), new Map()).htmlEmphasis(focalLv));
      expect(wrapper.hasClass('is-findMatch')).toBe(true);
      expect(wrapper.hasClass('is-focalNode')).toBe(true);
      expect(wrapper.type()).toBe('div');
    });
  });

  describe('vectorFindColorBand', () => {
    it('is null if findMatches set is empty', () => {
      expect(getNodeRenderers(new Set(), new Map()).vectorFindColorBand).toBe(null);
    });

    it('returns null if provided vertex is not in set', () => {
      expect(
        getNodeRenderers(new Set([{ vertex: { key: `not-${key}` } }]), new Map()).vectorFindColorBand(lv)
      ).toBe(null);
    });

    it('returns circle with correct size and className', () => {
      expect(
        shallow(getNodeRenderers(new Set([lv.vertex]), new Map()).vectorFindColorBand(lv))
      ).toMatchSnapshot();
    });
  });
});
