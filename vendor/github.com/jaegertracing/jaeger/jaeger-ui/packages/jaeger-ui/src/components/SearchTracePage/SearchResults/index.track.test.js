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

import { trackAltView, CATEGORY_ALT_VIEW, EAltViewActions } from './index.track';
import * as trackingUtils from '../../../utils/tracking';

describe('SearchResults tracking', () => {
  let trackEvent;

  beforeAll(() => {
    trackEvent = jest.spyOn(trackingUtils, 'trackEvent').mockImplementation();
  });

  beforeEach(() => {
    trackEvent.mockClear();
  });

  it('tracks changes to view', () => {
    const actions = Object.values(EAltViewActions);
    // sanity check
    expect(actions.length).toBeGreaterThan(0);

    actions.forEach(action => {
      trackAltView(action);
      expect(trackEvent).toHaveBeenLastCalledWith(CATEGORY_ALT_VIEW, action);
    });
  });
});
