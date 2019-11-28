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
import { Button } from 'antd';

import AltViewOptions from './AltViewOptions';

describe('AltViewOptions', () => {
  const props = {
    traceResultsView: true,
    onTraceGraphViewClicked: jest.fn(),
  };
  let wrapper;

  beforeEach(() => {
    props.onTraceGraphViewClicked.mockClear();
    wrapper = shallow(<AltViewOptions {...props} />);
  });

  it('renders correct label', () => {
    const getLabel = () => wrapper.find(Button).prop('children');
    expect(getLabel()).toBe('Deep Dependency Graph');

    wrapper.setProps({ traceResultsView: false });
    expect(getLabel()).toBe('Trace Results');
  });
});
