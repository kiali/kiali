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

import {
  focalPayloadElem,
  longSimplePath,
  shortPath,
  simplePath,
  wrap,
} from '../../../../model/ddg/sample-paths.test.resources';
import transformDdgData from '../../../../model/ddg/transformDdgData';
import * as codec from '../../../../model/ddg/visibility-codec';
import HopsSelector from '.';

describe('HopsSelector', () => {
  const { distanceToPathElems } = transformDdgData(wrap([longSimplePath, simplePath]), focalPayloadElem);
  const { distanceToPathElems: shortPathElems } = transformDdgData(wrap([shortPath]), focalPayloadElem);

  describe('without distanceToPathElems', () => {
    it('renders empty div', () => {
      const wrapper = shallow(<HopsSelector />);
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('with distanceToPathElems', () => {
    describe('without visEncoding', () => {
      it('renders hops within two hops as full and others as empty', () => {
        const wrapper = shallow(<HopsSelector distanceToPathElems={distanceToPathElems} />);
        expect(wrapper).toMatchSnapshot();
      });

      it('handles DDGs smaller than two hops', () => {
        const wrapper = shallow(<HopsSelector distanceToPathElems={shortPathElems} />);
        expect(wrapper).toMatchSnapshot();
      });
    });

    describe('with visEncoding', () => {
      it('renders hops with correct fullness', () => {
        const visEncoding = codec.encode([0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13]);
        const wrapper = shallow(
          <HopsSelector distanceToPathElems={distanceToPathElems} visEncoding={visEncoding} />
        );
        expect(wrapper).toMatchSnapshot();
      });
    });
  });
});
