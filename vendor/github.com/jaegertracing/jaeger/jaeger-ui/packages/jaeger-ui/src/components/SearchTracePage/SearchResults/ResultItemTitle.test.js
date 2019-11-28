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
import { Checkbox } from 'antd';
import { shallow } from 'enzyme';
import { Link } from 'react-router-dom';

import ResultItemTitle from './ResultItemTitle';
import { fetchedState } from '../../../constants';

describe('ResultItemTitle', () => {
  const defaultProps = {
    duration: 150,
    durationPercent: 10,
    isInDiffCohort: true,
    linkTo: 'linkToValue',
    state: fetchedState.DONE,
    toggleComparison: jest.fn(),
    traceID: 'trace-id-longer-than-8',
    traceName: 'traceNameValue',
  };
  let wrapper;

  beforeEach(() => {
    defaultProps.toggleComparison.mockReset();
    wrapper = shallow(<ResultItemTitle {...defaultProps} />);
  });

  it('renders as expected', () => {
    expect(wrapper).toMatchSnapshot();
  });

  describe('Checkbox', () => {
    it('does not render toggleComparison checkbox when props.disableComparision is true', () => {
      expect(wrapper.find(Checkbox).length).toBe(1);
      wrapper.setProps({ disableComparision: true });
      expect(wrapper.find(Checkbox).length).toBe(0);
    });

    it('is disabled iff props.state === fetchedState.ERROR', () => {
      expect(wrapper.find(Checkbox).prop('disabled')).toBe(false);
      wrapper.setProps({ state: fetchedState.ERROR });
      expect(wrapper.find(Checkbox).prop('disabled')).toBe(true);
    });

    it('is checked iff props.state !== fetchedState.ERROR && props.isInDiffCohort', () => {
      [true, false].forEach(isInDiffCohort => {
        [fetchedState.ERROR, fetchedState.DONE].forEach(state => {
          wrapper.setProps({ isInDiffCohort, state });
          expect(wrapper.find(Checkbox).prop('checked')).toBe(state !== fetchedState.ERROR && isInDiffCohort);
        });
      });
    });

    it('calls props.toggleComparison with correct arguments onChange', () => {
      wrapper.find(Checkbox).prop('onChange')();
      expect(defaultProps.toggleComparison).toHaveBeenCalledWith(
        defaultProps.traceID,
        defaultProps.isInDiffCohort
      );
      wrapper.setProps({ isInDiffCohort: !defaultProps.isInDiffCohort });
      wrapper.find(Checkbox).prop('onChange')();
      expect(defaultProps.toggleComparison).toHaveBeenLastCalledWith(
        defaultProps.traceID,
        !defaultProps.isInDiffCohort
      );
    });
  });

  describe('WrapperComponent', () => {
    it('renders <Link> when linkTo is provided', () => {
      expect(wrapper.find(Link).length).toBe(1);
      wrapper.setProps({ linkTo: null });
      expect(wrapper.find(Link).length).toBe(0);
    });

    it('<Link> targets _blank and sets rel when targetBlank is true', () => {
      expect(wrapper.find(Link).prop('target')).toBeUndefined();
      expect(wrapper.find(Link).prop('rel')).toBeUndefined();
      wrapper.setProps({ targetBlank: true });
      expect(wrapper.find(Link).prop('target')).toBe('_blank');
      expect(wrapper.find(Link).prop('rel')).toBe('noopener noreferrer');
    });

    it('hides formated duration when duration is not provided', () => {
      const initialSpanCount = wrapper.find('span').length;
      wrapper.setProps({ duration: null });
      expect(wrapper.find('span').length).toBe(initialSpanCount - 1);
    });
  });
});
