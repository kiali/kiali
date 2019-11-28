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

import React from 'react';
import { mount, shallow } from 'enzyme';
import { XAxis, YAxis } from 'react-vis';

import ScatterPlot, { ScatterPlotImpl } from './ScatterPlot';
import { ONE_MILLISECOND } from '../../../utils/date';

const generateTimestamp = (hours, minutes, seconds) => {
  const UTCMilliseconds = new Date(2018, 10, 13, hours, minutes, seconds).getTime();

  return UTCMilliseconds * ONE_MILLISECOND;
};

const sampleData = [
  {
    x: generateTimestamp(22, 10, 17),
    y: 1,
    traceID: '576b0c2330db100b',
    size: 1,
  },
  {
    x: generateTimestamp(22, 10, 22),
    y: 2,
    traceID: '6fb42ddd88f4b4f2',
    size: 1,
  },
  {
    x: generateTimestamp(22, 10, 46),
    y: 77707,
    traceID: '1f7185d56ef5dc07',
    size: 3,
  },
  {
    x: generateTimestamp(22, 11, 6),
    y: 80509,
    traceID: '21ba1f993ceddd8f',
    size: 3,
  },
];

it('<ScatterPlot /> should render base case correctly', () => {
  const wrapper = shallow(
    <ScatterPlot
      data={[
        { x: Date.now() - 3000, y: 1, traceID: 1 },
        { x: Date.now() - 2000, y: 2, traceID: 2 },
        { x: Date.now() - 1000, y: 2, traceID: 2 },
        { x: Date.now(), y: 3, traceID: 3 },
      ]}
    />,
    { disableLifecycleMethods: true }
  );
  expect(wrapper).toBeTruthy();
});

it('<ScatterPlotImpl /> should render X axis correctly', () => {
  const wrapper = mount(
    <ScatterPlotImpl
      containerWidth={1200}
      containerHeight={200}
      data={sampleData}
      onValueClick={() => null}
      onValueOut={() => null}
      onValueOver={() => null}
    />
  );

  const xAxisText = wrapper.find(XAxis).text();

  expect(xAxisText).toContain('10:10:20 pm');
  expect(xAxisText).toContain('10:10:30 pm');
  expect(xAxisText).toContain('10:10:40 pm');
  expect(xAxisText).toContain('10:10:50 pm');
  expect(xAxisText).toContain('10:11:00 pm');
});

it('<ScatterPlotImpl /> should render Y axis correctly', () => {
  const wrapper = mount(
    <ScatterPlotImpl
      containerWidth={1200}
      containerHeight={200}
      data={sampleData}
      onValueClick={() => null}
      onValueOut={() => null}
      onValueOver={() => null}
    />
  );

  const yAxisText = wrapper.find(YAxis).text();

  expect(yAxisText).toContain('20ms');
  expect(yAxisText).toContain('40ms');
  expect(yAxisText).toContain('60ms');
  expect(yAxisText).toContain('80ms');
});
