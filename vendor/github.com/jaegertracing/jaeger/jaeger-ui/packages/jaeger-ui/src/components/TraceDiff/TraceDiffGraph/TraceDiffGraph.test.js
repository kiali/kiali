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
// import _mapValues from 'lodash/mapValues';

import { UnconnectedTraceDiffGraph as TraceDiffGraph } from './TraceDiffGraph';
import ErrorMessage from '../../common/ErrorMessage';
import LoadingIndicator from '../../common/LoadingIndicator';
import { fetchedState } from '../../../constants';

describe('TraceDiffGraph', () => {
  const props = {
    a: {
      data: {
        spans: [],
        traceID: 'trace-id-a',
      },
      error: null,
      id: 'trace-id-a',
      state: fetchedState.DONE,
    },
    b: {
      data: {
        spans: [],
        traceID: 'trace-id-b',
      },
      error: null,
      id: 'trace-id-b',
      state: fetchedState.DONE,
    },
  };
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<TraceDiffGraph {...props} />);
  });

  it('renders warning when a or b are not provided', () => {
    expect(wrapper.find('h1').length).toBe(0);

    wrapper.setProps({ a: undefined });
    expect(wrapper.find('h1').length).toBe(1);
    expect(wrapper.find('h1').text()).toBe('At least two Traces are needed');

    wrapper.setProps({ b: undefined });
    expect(wrapper.find('h1').length).toBe(1);
    expect(wrapper.find('h1').text()).toBe('At least two Traces are needed');

    wrapper.setProps({ a: props.a });
    expect(wrapper.find('h1').length).toBe(1);
    expect(wrapper.find('h1').text()).toBe('At least two Traces are needed');
  });

  it('renders warning when a or b have errored', () => {
    expect(wrapper.find(ErrorMessage).length).toBe(0);

    const errorA = 'some error text for trace a';
    wrapper.setProps({
      a: {
        ...props.a,
        error: errorA,
      },
    });

    expect(wrapper.find(ErrorMessage).length).toBe(1);
    expect(wrapper.find(ErrorMessage).props()).toEqual(
      expect.objectContaining({
        error: errorA,
      })
    );
    const errorB = 'some error text for trace a';
    wrapper.setProps({
      b: {
        ...props.b,
        error: errorB,
      },
    });

    expect(wrapper.find(ErrorMessage).length).toBe(2);
    expect(
      wrapper
        .find(ErrorMessage)
        .at(1)
        .props()
    ).toEqual(
      expect.objectContaining({
        error: errorB,
      })
    );
    wrapper.setProps({
      a: props.a,
    });
    expect(wrapper.find(ErrorMessage).length).toBe(1);
    expect(wrapper.find(ErrorMessage).props()).toEqual(
      expect.objectContaining({
        error: errorB,
      })
    );
  });

  it('renders a loading indicator when a or b are loading', () => {
    expect(wrapper.find(LoadingIndicator).length).toBe(0);

    wrapper.setProps({
      a: {
        state: fetchedState.LOADING,
      },
    });
    expect(wrapper.find(LoadingIndicator).length).toBe(1);

    wrapper.setProps({
      b: {
        state: fetchedState.LOADING,
      },
    });
    expect(wrapper.find(LoadingIndicator).length).toBe(1);

    wrapper.setProps({ a: props.a });
    expect(wrapper.find(LoadingIndicator).length).toBe(1);
  });

  it('renders an empty div when a or b lack data', () => {
    expect(wrapper.children().length).not.toBe(0);

    const { data: unusedAData, ...aWithoutData } = props.a;
    wrapper.setProps({ a: aWithoutData });
    expect(wrapper.children().length).toBe(0);

    const { data: unusedBData, ...bWithoutData } = props.b;
    wrapper.setProps({ b: bWithoutData });
    expect(wrapper.children().length).toBe(0);

    wrapper.setProps({ a: props.a });
    expect(wrapper.children().length).toBe(0);
  });

  it('cleans up layoutManager before unmounting', () => {
    const layoutManager = jest.spyOn(wrapper.instance().layoutManager, 'stopAndRelease');
    wrapper.unmount();
    expect(layoutManager).toHaveBeenCalledTimes(1);
  });
});
