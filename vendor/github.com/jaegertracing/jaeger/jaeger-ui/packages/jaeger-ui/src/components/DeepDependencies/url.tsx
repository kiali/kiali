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

import _isEmpty from 'lodash/isEmpty';
import memoizeOne from 'memoize-one';
import queryString from 'query-string';
import { matchPath } from 'react-router-dom';

import { EDdgDensity, TDdgSparseUrlState } from '../../model/ddg/types';
import prefixUrl from '../../utils/prefix-url';

export const ROUTE_PATH = prefixUrl('/deep-dependencies');

const ROUTE_MATCHER = { path: ROUTE_PATH, strict: true, exact: true };

export function matches(path: string) {
  return Boolean(matchPath(path, ROUTE_MATCHER));
}

export function getUrl(args?: { [key: string]: unknown; showOp?: boolean }, baseUrl: string = ROUTE_PATH) {
  if (args && !_isEmpty(args)) {
    const stringifyArgs = Reflect.has(args, 'showOp')
      ? {
          ...args,
          showOp: args.showOp ? 1 : 0,
        }
      : args;
    return `${baseUrl}?${queryString.stringify(stringifyArgs)}`;
  }
  return baseUrl;
}

function firstParam(arg: string | string[]): string {
  if (Array.isArray(arg)) {
    const returnVal = arg[0];
    console.warn(`Found multiple query parameters: "${arg}", using "${returnVal}"`); // eslint-disable-line no-console
    return returnVal;
  }
  return arg;
}

export const getUrlState = memoizeOne(function getUrlState(search: string): TDdgSparseUrlState {
  const {
    density = EDdgDensity.PreventPathEntanglement,
    end,
    hash,
    operation,
    service,
    showOp = '1',
    start,
    visEncoding,
  } = queryString.parse(search);
  const rv: TDdgSparseUrlState = {
    density: firstParam(density) as EDdgDensity,
    showOp: Boolean(+firstParam(showOp)),
  };
  if (end) {
    rv.end = Number.parseInt(firstParam(end), 10);
  }
  if (hash) {
    rv.hash = firstParam(hash);
  }
  if (operation) {
    rv.operation = firstParam(operation);
  }
  if (service) {
    rv.service = firstParam(service);
  }
  if (start) {
    rv.start = Number.parseInt(firstParam(start), 10);
  }
  if (visEncoding) {
    rv.visEncoding = firstParam(visEncoding);
  }
  return rv;
});

export const sanitizeUrlState = memoizeOne(function sanitizeUrlStateImpl(
  state: TDdgSparseUrlState,
  hash?: string
): TDdgSparseUrlState {
  if (hash && state.hash === hash) {
    return state;
  }
  const { visEncoding, ...sanitized } = state; // eslint-disable-line @typescript-eslint/no-unused-vars
  return sanitized;
});
