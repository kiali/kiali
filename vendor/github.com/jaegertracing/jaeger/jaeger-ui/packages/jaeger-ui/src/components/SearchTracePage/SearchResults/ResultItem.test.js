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
import { Tag } from 'antd';
import { shallow } from 'enzyme';

import ResultItem from './ResultItem';
import * as markers from './ResultItem.markers';
import traceGenerator from '../../../demo/trace-generators';
import transformTraceData from '../../../model/transform-trace-data';

const trace = transformTraceData(traceGenerator.trace({}));

it('<ResultItem /> should render base case correctly', () => {
  const wrapper = shallow(<ResultItem trace={trace} durationPercent={50} />);
  const numberOfSpanText = wrapper
    .find(`[data-test="${markers.NUM_SPANS}"]`)
    .first()
    .render()
    .text();
  const serviceTags = wrapper.find(`[data-test="${markers.SERVICE_TAGS}"]`).find(Tag);
  expect(numberOfSpanText).toBe(`${trace.spans.length} Spans`);
  expect(serviceTags).toHaveLength(trace.services.length);
});

it('<ResultItem /> should not render any ServiceTags when there are no services', () => {
  const wrapper = shallow(<ResultItem trace={{ ...trace, services: [] }} durationPercent={50} />);
  const serviceTags = wrapper.find(`[data-test="${markers.SERVICE_TAGS}"]`).find(Tag);
  expect(serviceTags).toHaveLength(0);
});
