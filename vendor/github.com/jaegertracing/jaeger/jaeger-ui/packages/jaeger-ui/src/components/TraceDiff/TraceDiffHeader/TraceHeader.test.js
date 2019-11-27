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

import * as React from 'react';
import { shallow } from 'enzyme';

import TraceHeader, { Attrs, EmptyAttrs } from './TraceHeader';
import { fetchedState } from '../../../constants';

describe('TraceHeader', () => {
  const props = {
    duration: 700,
    error: { errorKey: 'errorValue' },
    traceID: 'trace-id',
    traceName: 'trace name',
  };
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<TraceHeader {...props} />);
  });

  it('renders as expected', () => {
    expect(wrapper).toMatchSnapshot();
  });

  it('renders populated attrs component when props.state === fetchedState.DONE', () => {
    wrapper.setProps({
      startTime: 150,
      totalSpans: 50,
      state: fetchedState.DONE,
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('renders "Select a Trace..." when props.traceID is not provided ', () => {
    wrapper.setProps({
      traceID: null,
    });
    expect(wrapper.find('.u-tx-muted').text()).toBe('Select a Trace...');
  });

  describe('EmptyAttrs', () => {
    it('renders as expected', () => {
      expect(shallow(<EmptyAttrs />)).toMatchSnapshot();
    });
  });

  describe('Attrs', () => {
    it('renders as expected when provided props', () => {
      expect(shallow(<Attrs duration={700} startTime={150} totalSpans={50} />)).toMatchSnapshot();
    });

    it('Attrs renders as expected when missing props', () => {
      expect(shallow(<Attrs />)).toMatchSnapshot();
    });
  });
});
