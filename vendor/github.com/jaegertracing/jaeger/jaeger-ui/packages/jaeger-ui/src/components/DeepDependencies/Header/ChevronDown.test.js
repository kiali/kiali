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

import React from 'react';
import { shallow } from 'enzyme';
import IoChevronDown from 'react-icons/lib/io/chevron-down';

import ChevronDown from './ChevronDown';

describe('ChevronDown', () => {
  it('renders with provided className and style', () => {
    const className = 'testClassName';
    const style = {
      border: 'black solid 1px',
    };
    const wrapper = shallow(<ChevronDown className={className} style={style} />);

    expect(wrapper.hasClass(className)).toBe(true);
    expect(wrapper.find(IoChevronDown).prop('style')).toBe(style);
  });

  it('does not add `undefined` as a className when not given a className', () => {
    const wrapper = shallow(<ChevronDown />);
    expect(wrapper.hasClass('undefined')).toBe(false);
  });
});
