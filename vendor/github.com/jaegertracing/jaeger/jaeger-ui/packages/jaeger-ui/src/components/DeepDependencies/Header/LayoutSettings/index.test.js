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
import { Checkbox, Radio, Popover } from 'antd';
import { shallow } from 'enzyme';

import LayoutSettings, { densityOptions } from '.';
import * as track from '../../index.track';

import { EDdgDensity } from '../../../../model/ddg/types';

describe('LayoutSettings', () => {
  const props = {
    density: EDdgDensity.PreventPathEntanglement,
    setDensity: jest.fn(),
    showOperations: true,
    toggleShowOperations: jest.fn(),
  };
  const densityIdx = densityOptions.findIndex(({ option }) => option === props.density);

  const getWrapper = overrideProps => {
    const content = shallow(<LayoutSettings {...props} {...overrideProps} />)
      .find(Popover)
      .prop('content');
    return shallow(content);
  };
  let trackDensityChangeSpy;
  let trackToggleShowOpSpy;

  beforeAll(() => {
    trackDensityChangeSpy = jest.spyOn(track, 'trackDensityChange');
    trackToggleShowOpSpy = jest.spyOn(track, 'trackToggleShowOp');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders each densityOption', () => {
    const radios = getWrapper().find(Radio);

    expect(radios.length).toBe(densityOptions.length);
    expect(Array.from(radios).findIndex(radio => radio.props.checked)).toBe(densityIdx);
  });

  it('updates density and tracks its change', () => {
    const newIdx = 1;
    const newDensity = densityOptions[newIdx].option;
    getWrapper()
      .find(Radio)
      .at(newIdx)
      .simulate('change', { target: { value: newDensity } });
    expect(props.setDensity).toHaveBeenCalledWith(newDensity);
    expect(trackDensityChangeSpy).toHaveBeenCalledWith(props.density, newDensity, densityOptions);
  });

  it('no-ops if current density is selected', () => {
    getWrapper()
      .find(Radio)
      .at(densityIdx)
      .simulate('change', { target: { value: props.density } });
    expect(props.setDensity).not.toHaveBeenCalled();
    expect(trackDensityChangeSpy).not.toHaveBeenCalled();
  });

  it('renders showOperations checkbox', () => {
    expect(
      getWrapper()
        .find(Checkbox)
        .prop('checked')
    ).toBe(props.showOperations);

    const showOperations = !props.showOperations;
    expect(
      getWrapper({ showOperations })
        .find(Checkbox)
        .prop('checked')
    ).toBe(showOperations);
  });

  it('toggles showOperation and tracks its toggle', () => {
    const checked = !props.showOperations;
    getWrapper()
      .find(Checkbox)
      .simulate('change', { target: { checked } });

    expect(props.toggleShowOperations).toHaveBeenCalledWith(checked);
    expect(trackToggleShowOpSpy).toHaveBeenCalledWith(checked);
  });
});
