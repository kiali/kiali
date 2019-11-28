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

import { fetchServices, fetchServiceOperations } from '../actions/jaeger-api';
import serviceReducer from './services';

const initialState = serviceReducer(undefined, {});

function verifyInitialState() {
  expect(initialState).toEqual({
    services: null,
    loading: false,
    error: null,
    operationsForService: {},
  });
}

beforeEach(verifyInitialState);
afterEach(verifyInitialState);

it('#92 - ensures services is at least an empty array', () => {
  const services = null;
  const state = serviceReducer(initialState, {
    type: `${fetchServices}_FULFILLED`,
    payload: { data: services },
  });
  expect(state).toEqual({
    services: [],
    operationsForService: {},
    loading: false,
    error: null,
  });
});

it('should handle a fetch services with loading state', () => {
  const state = serviceReducer(initialState, {
    type: `${fetchServices}_PENDING`,
  });
  const expected = { ...initialState, loading: true };
  expect(state).toEqual(expected);
});

it('should handle successful services fetch', () => {
  const services = ['a', 'b', 'c'];
  const state = serviceReducer(initialState, {
    type: `${fetchServices}_FULFILLED`,
    payload: { data: services.slice() },
  });
  expect(state).toEqual({
    services,
    operationsForService: {},
    loading: false,
    error: null,
  });
});

it('should handle a failed services fetch', () => {
  const error = new Error('some-message');
  const state = serviceReducer(initialState, {
    type: `${fetchServices}_REJECTED`,
    payload: error,
  });
  expect(state).toEqual({
    error,
    services: [],
    operationsForService: {},
    loading: false,
  });
});

it('should handle a successful fetching operations for a service ', () => {
  const ops = ['a', 'b'];
  const state = serviceReducer(initialState, {
    type: `${fetchServiceOperations}_FULFILLED`,
    meta: { serviceName: 'serviceA' },
    payload: { data: ops.slice() },
  });
  const expected = {
    ...initialState,
    operationsForService: {
      serviceA: ops,
    },
  };
  expect(state).toEqual(expected);
});
