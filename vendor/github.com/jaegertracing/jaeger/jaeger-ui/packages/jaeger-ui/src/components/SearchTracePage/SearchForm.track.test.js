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
jest.mock('../../utils/tracking');

import {
  middlewareHooks,
  trackFormInput,
  CATEGORY_LIMIT,
  CATEGORY_LOOKBACK,
  CATEGORY_MAX_DURATION,
  CATEGORY_MIN_DURATION,
  CATEGORY_OPERATION,
  CATEGORY_SORTBY,
  CATEGORY_TAGS,
} from './SearchForm.track';
import { FORM_CHANGE_ACTION_TYPE } from '../../constants/search-form';
import { trackEvent } from '../../utils/tracking';

describe('GA tracking', () => {
  it('tracks changing sort criteria', () => {
    const action = { meta: { form: 'sortBy' }, payload: 'MOST_RECENT' };
    middlewareHooks[FORM_CHANGE_ACTION_TYPE]({}, action);
    expect(trackEvent.mock.calls.length).toBe(1);
    expect(trackEvent.mock.calls[0]).toEqual([CATEGORY_SORTBY, expect.any(String)]);
  });

  it('sends form input to GA', () => {
    trackEvent.mockClear();
    trackFormInput(0, '', {}, 0, 0, '');
    expect(trackEvent.mock.calls.length).toBe(6);
    const categoriesTracked = trackEvent.mock.calls.map(call => call[0]).sort();
    expect(categoriesTracked).toEqual(
      [
        CATEGORY_OPERATION,
        CATEGORY_LIMIT,
        CATEGORY_TAGS,
        CATEGORY_MAX_DURATION,
        CATEGORY_MIN_DURATION,
        CATEGORY_LOOKBACK,
      ].sort()
    );
  });
});
