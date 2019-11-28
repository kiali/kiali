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

import { fetchDependencies } from '../actions/jaeger-api';
import reducer from './dependencies';

const initialState = reducer(undefined, {});

function verifyInitialState() {
  expect(initialState).toEqual({
    dependencies: [],
    loading: false,
    error: null,
  });
}

beforeEach(verifyInitialState);
afterEach(verifyInitialState);

it('sets loading to true when fetching dependencies is pending', () => {
  const state = reducer(initialState, {
    type: `${fetchDependencies}_PENDING`,
  });
  expect(state.loading).toBe(true);
});

it('handles a successful dependencies fetch', () => {
  const deps = ['a', 'b', 'c'];
  const state = reducer(initialState, {
    type: `${fetchDependencies}_FULFILLED`,
    payload: { data: deps.slice() },
  });
  expect(state.loading).toBe(false);
  expect(state.dependencies).toEqual(deps);
});

it('handles a failed dependencies fetch', () => {
  const error = new Error('some-message');
  const state = reducer(initialState, {
    type: `${fetchDependencies}_REJECTED`,
    payload: error,
  });
  expect(state.loading).toBe(false);
  expect(state.dependencies).toEqual([]);
  expect(state.error).toBe(error);
});
