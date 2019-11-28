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

import { EDdgDensity, EDirection } from '../../model/ddg/types';
import { trackEvent } from '../../utils/tracking';
import getTrackFilter from '../../utils/tracking/getTrackFilter';

// export for tests
export const CATEGORY_DENSITY_CHANGE = 'jaeger/ux/ddg/density-change';
export const CATEGORY_DENSITY_SELECTION = 'jaeger/ux/ddg/density-selection';
export const CATEGORY_DOWNSTREAM_HOPS_CHANGE = 'jaeger/ux/ddg/category-downstream-hops-change';
export const CATEGORY_DOWNSTREAM_HOPS_SELECTION = 'jaeger/ux/ddg/category-downstream-hops-selection';
export const CATEGORY_FILTER = 'jaeger/ux/ddg/filter';
export const CATEGORY_MATCH_INTERACTIONS = 'jaeger/ux/ddg/match-interactions';
export const CATEGORY_TOGGLE_SHOW_OP = 'jaeger/ux/ddg/toggle-show-op';
export const CATEGORY_UPSTREAM_HOPS_CHANGE = 'jaeger/ux/ddg/category-upstream-hops-change';
export const CATEGORY_UPSTREAM_HOPS_SELECTION = 'jaeger/ux/ddg/category-upstream-hops-selection';

// export for tests
export const ACTION_DECREASE = 'decrease';
export const ACTION_HIDE = 'hide';
export const ACTION_INCREASE = 'increase';
export const ACTION_SHOW = 'show';

export function trackDensityChange(
  prevDensity: EDdgDensity,
  nextDensity: EDdgDensity,
  densities: ({ option: EDdgDensity } & Record<string, unknown>)[]
) {
  if (prevDensity === nextDensity) return;

  let prevIndex: number | undefined;
  let nextIndex: number | undefined;
  densities.forEach(({ option: density }, i) => {
    if (density === prevDensity) prevIndex = i;
    if (density === nextDensity) nextIndex = i;
  });

  if (prevIndex === undefined) {
    console.warn(`Received unknown density ${prevDensity}`); // eslint-disable-line no-console
  }
  if (nextIndex === undefined) {
    console.warn(`Received unknown density ${nextDensity}`); // eslint-disable-line no-console
    return;
  }
  if (prevIndex === undefined) return;

  const action = prevIndex > nextIndex ? ACTION_INCREASE : ACTION_DECREASE;
  trackEvent(CATEGORY_DENSITY_CHANGE, action);
  trackEvent(CATEGORY_DENSITY_SELECTION, nextDensity);
}

export const trackFilter = getTrackFilter(CATEGORY_FILTER);

export function trackHopChange(
  prevFurthestFullDistance: number,
  nextFurthestFullDistance: number,
  direction: EDirection
) {
  if (prevFurthestFullDistance === nextFurthestFullDistance) return;

  const changeAction =
    Math.abs(nextFurthestFullDistance) > Math.abs(prevFurthestFullDistance)
      ? ACTION_INCREASE
      : ACTION_DECREASE;
  const [selectionCategory, changeCategory] =
    direction === EDirection.Upstream
      ? [CATEGORY_UPSTREAM_HOPS_SELECTION, CATEGORY_UPSTREAM_HOPS_CHANGE]
      : [CATEGORY_DOWNSTREAM_HOPS_SELECTION, CATEGORY_DOWNSTREAM_HOPS_CHANGE];
  trackEvent(selectionCategory, `${nextFurthestFullDistance}`);
  trackEvent(changeCategory, changeAction);
}

export function trackShowMatches() {
  trackEvent(CATEGORY_MATCH_INTERACTIONS, ACTION_SHOW);
}

export function trackToggleShowOp(value: boolean) {
  const action = value ? ACTION_SHOW : ACTION_HIDE;
  trackEvent(CATEGORY_TOGGLE_SHOW_OP, action);
}
