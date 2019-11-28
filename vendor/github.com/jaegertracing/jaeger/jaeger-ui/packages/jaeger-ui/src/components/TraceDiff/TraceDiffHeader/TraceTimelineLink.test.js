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

import TraceTimelineLink from './TraceTimelineLink';
import NewWindowIcon from '../../common/NewWindowIcon';

describe('TraceTimelineLink', () => {
  const traceID = 'test-trace-id';
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<TraceTimelineLink traceID={traceID} />);
  });

  it('renders the NewWindowIcon', () => {
    expect(wrapper.find(NewWindowIcon).length).toBe(1);
  });

  it('links to the given trace', () => {
    expect(wrapper.find('a').prop('href')).toBe(`/trace/${traceID}`);
  });

  it('stops event propagation', () => {
    const stopPropagation = jest.fn();
    wrapper.find('a').simulate('click', { stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
  });
});
