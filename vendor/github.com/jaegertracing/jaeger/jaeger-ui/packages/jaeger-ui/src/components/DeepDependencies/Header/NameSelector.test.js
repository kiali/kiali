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
import { Popover } from 'antd';
import { shallow } from 'enzyme';

import BreakableText from '../../common/BreakableText';
import NameSelector, { DEFAULT_PLACEHOLDER } from './NameSelector';

describe('<NameSelector>', () => {
  const placeholder = 'This is the placeholder';
  let props;
  let wrapper;

  beforeEach(() => {
    props = {
      placeholder,
      label: 'a-label',
      options: ['a', 'b', 'c'],
      value: null,
      required: true,
      setValue: jest.fn(),
    };
    wrapper = shallow(<NameSelector {...props} />);
  });

  it('renders without exploding', () => {
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with is-invalid when required and without a value', () => {
    expect(wrapper).toMatchSnapshot();
  });

  it('renders without is-invalid when not required and without a value', () => {
    wrapper.setProps({ required: undefined });
    expect(wrapper).toMatchSnapshot();
  });

  describe('placeholder prop', () => {
    it('renders the placeholder when it is a string and value == null', () => {
      wrapper.setProps({ placeholder, value: null });
      expect(wrapper.find(BreakableText).prop('text')).toBe(placeholder);
    });

    it('renders the default placeholder when the prop is true and value == null', () => {
      wrapper.setProps({ placeholder: true, value: null });
      expect(wrapper.find(BreakableText).prop('text')).toBe(DEFAULT_PLACEHOLDER);
    });

    it('does not render a placeholder if there is a value', () => {
      const value = 'some-value';
      wrapper.setProps({ placeholder, value });
      expect(wrapper.find(BreakableText).prop('text')).toBe(value);
      wrapper.setProps({ placeholder: true, value });
      expect(wrapper.find(BreakableText).prop('text')).toBe(value);
    });

    it('does not render default placeholder if placeholder is disabled', () => {
      wrapper.setProps({ placeholder: undefined });
      expect(wrapper.find(BreakableText).prop('text')).toBe('');
    });
  });

  it('allows the filtered list to set values', () => {
    const v = 'test-value';
    const popover = wrapper.find(Popover);
    const list = popover.prop('content');
    list.props.setValue(v);
    expect(props.setValue.mock.calls).toEqual([[v]]);
  });

  it('hides the popover when the filter calls cancel', () => {
    wrapper.setState({ popoverVisible: true });
    const popover = wrapper.find(Popover);
    const list = popover.prop('content');
    list.props.cancel();
    expect(wrapper.state('popoverVisible')).toBe(false);
  });

  it('hides the popover when clicking outside of the open popover', () => {
    let mouseWithin = false;
    wrapper.setState({ popoverVisible: true });
    wrapper.instance().listRef = {
      current: {
        focusInput: () => {},
        isMouseWithin: () => mouseWithin,
      },
    };
    wrapper.instance().onBodyClicked();
    expect(wrapper.state('popoverVisible')).toBe(false);

    wrapper.setState({ popoverVisible: true });
    mouseWithin = true;
    wrapper.instance().onBodyClicked();
    expect(wrapper.state('popoverVisible')).toBe(true);

    wrapper.instance().listRef = {};
    wrapper.instance().onBodyClicked();
    expect(wrapper.state('popoverVisible')).toBe(true);
  });

  it('controls the visibility of the popover', () => {
    expect(wrapper.state('popoverVisible')).toBe(false);
    const popover = wrapper.find(Popover);
    popover.prop('onVisibleChange')(true);
    expect(wrapper.state('popoverVisible')).toBe(true);
  });

  it('attempts to focus the filter input when the component updates', () => {
    const fn = jest.fn();
    wrapper.instance().listRef = {
      current: {
        focusInput: fn,
      },
    };
    wrapper.setState({ popoverVisible: true });
    expect(fn.mock.calls.length).toBe(1);
  });
});
