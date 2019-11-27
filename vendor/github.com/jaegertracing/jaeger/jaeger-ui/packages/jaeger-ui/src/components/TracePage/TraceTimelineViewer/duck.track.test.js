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

/* eslint-disable import/first */
jest.mock('../../../utils/tracking');

import DetailState from './SpanDetail/DetailState';
import * as track from './duck.track';
import { actionTypes as types } from './duck';
import { fetchedState } from '../../../constants';
import { trackEvent } from '../../../utils/tracking';

describe('middlewareHooks', () => {
  const traceID = 'ABC';
  const spanID = 'abc';
  const spanDepth = 123;
  const columnWidth = { real: 0.15, tracked: 150 };
  const payload = { spanID };
  const state = {
    trace: {
      traces: {
        [traceID]: {
          id: traceID,
          data: { spans: [{ spanID, depth: spanDepth }] },
          state: fetchedState.DONE,
        },
      },
    },
    traceTimeline: {
      traceID,
      childrenHiddenIDs: new Map(),
      detailStates: new Map([[spanID, new DetailState()]]),
    },
  };
  const store = {
    getState() {
      return state;
    },
  };

  beforeEach(trackEvent.mockClear);

  const cases = [
    {
      msg: 'tracks a GA event for resizing the span name column',
      type: types.SET_SPAN_NAME_COLUMN_WIDTH,
      payloadCustom: { width: columnWidth.real },
      category: track.CATEGORY_COLUMN,
      extraTrackArgs: [columnWidth.tracked],
    },
    {
      msg: 'tracks a GA event for collapsing a parent',
      type: types.CHILDREN_TOGGLE,
      category: track.CATEGORY_PARENT,
      extraTrackArgs: [123],
    },
    {
      msg: 'tracks a GA event for toggling a detail row',
      type: types.DETAIL_TOGGLE,
      category: track.CATEGORY_ROW,
    },
    {
      msg: 'tracks a GA event for toggling the span tags',
      type: types.DETAIL_TAGS_TOGGLE,
      category: track.CATEGORY_TAGS,
    },
    {
      msg: 'tracks a GA event for toggling the span tags',
      type: types.DETAIL_PROCESS_TOGGLE,
      category: track.CATEGORY_PROCESS,
    },
    {
      msg: 'tracks a GA event for toggling the span logs view',
      type: types.DETAIL_LOGS_TOGGLE,
      category: track.CATEGORY_LOGS,
    },
    {
      msg: 'tracks a GA event for toggling the span logs view',
      type: types.DETAIL_LOG_ITEM_TOGGLE,
      payloadCustom: { ...payload, logItem: {} },
      category: track.CATEGORY_LOGS_ITEM,
    },
  ];

  cases.forEach(_case => {
    const { msg, type, category, extraTrackArgs = [], payloadCustom = null } = _case;
    it(msg, () => {
      const action = { type, payload: payloadCustom || payload };
      track.middlewareHooks[type](store, action);
      expect(trackEvent.mock.calls.length).toBe(1);
      expect(trackEvent.mock.calls[0]).toEqual([category, expect.any(String), ...extraTrackArgs]);
    });
  });

  it('has the correct keys and they refer to functions', () => {
    expect(Object.keys(track.middlewareHooks).sort()).toEqual(
      [
        types.CHILDREN_TOGGLE,
        types.DETAIL_TOGGLE,
        types.DETAIL_TAGS_TOGGLE,
        types.DETAIL_PROCESS_TOGGLE,
        types.DETAIL_LOGS_TOGGLE,
        types.DETAIL_LOG_ITEM_TOGGLE,
        types.SET_SPAN_NAME_COLUMN_WIDTH,
      ].sort()
    );
  });
});
