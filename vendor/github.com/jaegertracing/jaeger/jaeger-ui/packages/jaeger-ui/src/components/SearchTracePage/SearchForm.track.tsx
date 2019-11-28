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

import { Store } from 'redux';

import * as constants from '../../constants/search-form';
import { trackEvent } from '../../utils/tracking';
import { ReduxState } from '../../types';

export const ACTION_SET = 'set';
export const ACTION_CLEAR = 'clear';
export const ACTION_DEFAULT = 'default';

export const CATEGORY_SORTBY = `jaeger/ux/search/results/sortby`;
export const FORM_CATEGORY_BASE = 'jaeger/ux/search/form';
export const CATEGORY_OPERATION = `${FORM_CATEGORY_BASE}/operation`;
export const CATEGORY_LOOKBACK = `${FORM_CATEGORY_BASE}/lookback`;
export const CATEGORY_TAGS = `${FORM_CATEGORY_BASE}/tags`;
export const CATEGORY_MIN_DURATION = `${FORM_CATEGORY_BASE}/min_duration`;
export const CATEGORY_MAX_DURATION = `${FORM_CATEGORY_BASE}/max_duration`;
export const CATEGORY_LIMIT = `${FORM_CATEGORY_BASE}/limit`;

export function trackFormInput(
  resultsLimit: number,
  operation: string,
  tags: any,
  minDuration: number,
  maxDuration: number,
  lookback: string
) {
  trackEvent(CATEGORY_OPERATION, operation === constants.DEFAULT_OPERATION ? ACTION_DEFAULT : ACTION_SET);
  trackEvent(CATEGORY_LIMIT, resultsLimit === constants.DEFAULT_LIMIT ? ACTION_DEFAULT : ACTION_SET);
  trackEvent(CATEGORY_MAX_DURATION, maxDuration ? ACTION_SET : ACTION_CLEAR);
  trackEvent(CATEGORY_MIN_DURATION, minDuration ? ACTION_SET : ACTION_CLEAR);
  trackEvent(CATEGORY_TAGS, tags ? ACTION_SET : ACTION_CLEAR);
  trackEvent(CATEGORY_LOOKBACK, lookback);
}

export const middlewareHooks = {
  [constants.FORM_CHANGE_ACTION_TYPE]: (store: Store<ReduxState>, action: any) => {
    if (action.meta.form === 'sortBy') {
      trackEvent(CATEGORY_SORTBY, action.payload);
    }
  },
};
