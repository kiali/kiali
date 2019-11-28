// Copyright (c) 2018 The Jaeger Authors.
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

import transformTraceData from '../../../model/transform-trace-data';
import calculateTraceDagEV from './calculateTraceDagEV';
import TraceGraph, { setOnEdgePath } from './TraceGraph';
import { MODE_SERVICE, MODE_TIME, MODE_SELFTIME } from './OpNode';

const testTrace = require('./testTrace.json');

const transformedTrace = transformTraceData(testTrace);
const ev = calculateTraceDagEV(transformedTrace);

describe('<TraceGraph>', () => {
  let wrapper;

  beforeEach(() => {
    const props = {
      headerHeight: 60,
      ev,
    };
    wrapper = shallow(<TraceGraph {...props} />);
  });

  it('does not explode', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper.find('.TraceGraph--menu').length).toBe(1);
    expect(wrapper.find('Button').length).toBe(3);
  });

  it('may show no traces', () => {
    const props = {};
    wrapper = shallow(<TraceGraph {...props} />);
    expect(wrapper).toBeDefined();
    expect(wrapper.find('h1').text()).toBe('No trace found');
  });

  it('toggles nodeMode to time', () => {
    const mode = MODE_SERVICE;
    wrapper.setState({ mode });
    wrapper.instance().toggleNodeMode(MODE_TIME);
    const modeState = wrapper.state('mode');
    expect(modeState).toEqual(MODE_TIME);
  });

  it('validates button nodeMode change click', () => {
    const toggleNodeMode = jest.spyOn(wrapper.instance(), 'toggleNodeMode');
    const btnService = wrapper.find('.TraceGraph--btn-service');
    expect(btnService.length).toBe(1);
    btnService.simulate('click');
    expect(toggleNodeMode).toHaveBeenCalledWith(MODE_SERVICE);
    const btnTime = wrapper.find('.TraceGraph--btn-time');
    expect(btnTime.length).toBe(1);
    btnTime.simulate('click');
    expect(toggleNodeMode).toHaveBeenCalledWith(MODE_TIME);
    const btnSelftime = wrapper.find('.TraceGraph--btn-selftime');
    expect(btnSelftime.length).toBe(1);
    btnSelftime.simulate('click');
    expect(toggleNodeMode).toHaveBeenCalledWith(MODE_SELFTIME);
  });

  it('shows help', () => {
    const showHelp = false;
    wrapper.setState({ showHelp });
    wrapper.instance().showHelp();
    expect(wrapper.state('showHelp')).toBe(true);
  });

  it('hides help', () => {
    const showHelp = true;
    wrapper.setState({ showHelp });
    wrapper.instance().closeSidebar();
    expect(wrapper.state('showHelp')).toBe(false);
  });

  it('uses stroke-dash edges for followsFrom', () => {
    const edge = { from: 0, to: 1, followsFrom: true };
    expect(setOnEdgePath(edge)).toEqual({ strokeDasharray: 4 });

    const edge2 = { from: 0, to: 1, followsFrom: false };
    expect(setOnEdgePath(edge2)).toEqual({});
  });
});
