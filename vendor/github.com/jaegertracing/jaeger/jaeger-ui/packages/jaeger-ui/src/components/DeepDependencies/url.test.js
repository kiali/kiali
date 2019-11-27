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

import queryString from 'query-string';
import * as reactRouterDom from 'react-router-dom';

import { ROUTE_PATH, matches, getUrl, getUrlState, sanitizeUrlState } from './url';

describe('DeepDependencyGraph/url', () => {
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
    it('handles no args given', () => {
      expect(getUrl()).toBe('/deep-dependencies');
    });

    it('handles empty args', () => {
      expect(getUrl({})).toBe('/deep-dependencies');
    });

    it('uses given baseUrl', () => {
      const baseUrl = 'test base url';
      expect(getUrl({}, baseUrl)).toBe(baseUrl);
    });

    it('includes provided args', () => {
      const paramA = 'aParam';
      const paramB = 'bParam';
      expect(getUrl({ paramA, paramB })).toBe(`/deep-dependencies?paramA=${paramA}&paramB=${paramB}`);
    });

    it('converts truthiness of showOp into 0 or 1', () => {
      expect(getUrl({ showOp: true })).toBe(`/deep-dependencies?showOp=1`);
      expect(getUrl({ showOp: false })).toBe(`/deep-dependencies?showOp=0`);
    });
  });

  describe('getUrlState', () => {
    const density = 'test density';
    const end = '900';
    const hash = 'test hash';
    const operation = 'operationName';
    const service = 'serviceName';
    const showOp = '0';
    const start = '400';
    const visEncoding = 'vis encoding';
    const acceptableParams = {
      density,
      end,
      hash,
      operation,
      service,
      showOp,
      start,
      visEncoding,
    };
    const expectedParams = {
      density,
      end: Number.parseInt(end, 10),
      hash,
      operation,
      service,
      showOp: Boolean(+showOp),
      start: Number.parseInt(start, 10),
      visEncoding,
    };
    let count = 0;
    const getSearch = () => `test search ${count++}`;
    let warnSpy;
    let parseSpy;

    beforeAll(() => {
      parseSpy = jest.spyOn(queryString, 'parse');
      warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    beforeEach(() => {
      parseSpy.mockReset();
      warnSpy.mockReset();
    });

    afterAll(() => {
      warnSpy.mockRestore();
    });

    it('gets all values from queryString', () => {
      const search = getSearch();
      parseSpy.mockReturnValue(acceptableParams);
      expect(getUrlState(search)).toEqual(expectedParams);
      expect(parseSpy).toHaveBeenCalledWith(search);
    });

    it('handles absent values', () => {
      ['end', 'hash', 'operation', 'service', 'start', 'visEncoding'].forEach(param => {
        const { [param]: unused, ...rest } = expectedParams;
        const { [param]: alsoUnused, ...rv } = acceptableParams;
        parseSpy.mockReturnValue(rv);
        expect(getUrlState(getSearch())).toEqual(rest);
      });
    });

    it('defaults `showOp` to true', () => {
      const { showOp: unused, ...rest } = expectedParams;
      const { showOp: alsoUnused, ...rv } = acceptableParams;
      parseSpy.mockReturnValue(rv);
      expect(getUrlState(getSearch())).toEqual({ ...rest, showOp: true });
    });

    it("defaults `density` to 'ppe'", () => {
      const { density: unused, ...rest } = expectedParams;
      const { density: alsoUnused, ...rv } = acceptableParams;
      parseSpy.mockReturnValue(rv);
      expect(getUrlState(getSearch())).toEqual({ ...rest, density: 'ppe' });
    });

    it('ignores extraneous query parameters', () => {
      const extraneous = {
        param: 'value',
      };
      parseSpy.mockReturnValue({
        ...extraneous,
        ...acceptableParams,
      });
      expect(getUrlState(getSearch())).toEqual(expect.not.objectContaining(extraneous));
    });

    it('omits falsy values', () => {
      ['end', 'hash', 'operation', 'service', 'start', 'visEncoding'].forEach(param => {
        [null, undefined, ''].forEach(falsyPossibility => {
          parseSpy.mockReturnValue({ ...expectedParams, [param]: falsyPossibility });
          expect(Reflect.has(getUrlState(getSearch()), param)).toBe(false);
        });
      });
    });

    it('handles and warns on duplicate values', () => {
      ['end', 'hash', 'operation', 'service', 'showOp', 'start', 'visEncoding'].forEach(param => {
        const secondParam = `second ${acceptableParams[param]}`;
        parseSpy.mockReturnValue({
          ...acceptableParams,
          [param]: [acceptableParams[param], secondParam],
        });
        expect(getUrlState(getSearch())[param]).toBe(expectedParams[param]);
      });
    });

    it('memoizes correctly', () => {
      const search = getSearch();
      parseSpy.mockReturnValue(acceptableParams);
      expect(getUrlState(search)).toBe(getUrlState(search));
      expect(getUrlState(getSearch())).not.toBe(getUrlState(search));
    });
  });

  describe('sanitizeUrlState', () => {
    const hash = 'test hash';
    const urlStateWithoutVisEncoding = {
      hash,
      operation: 'test operation',
      service: 'test service',
    };
    const urlState = {
      ...urlStateWithoutVisEncoding,
      visEncoding: 'test visEncoding',
    };

    it('returns provided state without visEncoding if hash was not provided', () => {
      expect(sanitizeUrlState(urlState)).toEqual(urlStateWithoutVisEncoding);
    });

    it('returns provided state without visEncoding if provided hash does not match urlState hash', () => {
      expect(sanitizeUrlState(urlState, `not ${hash}`)).toEqual(urlStateWithoutVisEncoding);
    });

    it('returns provided state visEncoding if provided hash does matches urlState hash', () => {
      expect(sanitizeUrlState(urlState, hash)).toBe(urlState);
    });
  });
});
