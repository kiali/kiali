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

import * as reactRouterDom from 'react-router-dom';

import { ROUTE_PATH, matches, getUrl } from './url';

describe('TraceDiff/url', () => {
  describe('matches', () => {
    const path = 'path argument';
    let matchPathSpy;

    beforeAll(() => {
      matchPathSpy = jest.spyOn(reactRouterDom, 'matchPath');
    });

    it('calls matchPath with expected arguments', () => {
      matches(path);
      expect(matchPathSpy).toHaveBeenLastCalledWith(path, {
        path: ROUTE_PATH,
        strict: true,
        exact: true,
      });
    });

    it("returns truthiness of matchPath's return value", () => {
      matchPathSpy.mockReturnValueOnce(null);
      expect(matches(path)).toBe(false);
      matchPathSpy.mockReturnValueOnce({});
      expect(matches(path)).toBe(true);
    });
  });

  describe('getUrl', () => {
    it('handles an empty state', () => {
      expect(getUrl({})).toBe('/trace/...');
    });

    it('handles a single traceId', () => {
      const cohort = ['first'];
      expect(getUrl({ cohort })).toBe(`/trace/${cohort[0]}...?cohort=${cohort[0]}`);
    });

    it('handles multiple traceIds', () => {
      const cohort = ['first', 'second', 'third'];
      const result = getUrl({ cohort });
      expect(result).toMatch(`${cohort[0]}...${cohort[1]}`);
      cohort.forEach(cohortEntry => {
        expect(result).toMatch(`cohort=${cohortEntry}`);
      });
    });
  });
});
