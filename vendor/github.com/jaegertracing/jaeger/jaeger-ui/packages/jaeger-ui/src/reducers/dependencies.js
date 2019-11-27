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

import { handleActions } from 'redux-actions';

import { fetchDependencies } from '../actions/jaeger-api';

const initialState = {
  dependencies: [],
  loading: false,
  error: null,
};

function fetchStarted(state) {
  return { ...state, loading: true };
}

function fetchDepsDone(state, { payload }) {
  return { ...state, dependencies: payload.data, loading: false };
}

function fetchDepsErred(state, { payload: error }) {
  return { ...state, error, dependencies: [], loading: false };
}

export default handleActions(
  {
    [`${fetchDependencies}_PENDING`]: fetchStarted,
    [`${fetchDependencies}_FULFILLED`]: fetchDepsDone,
    [`${fetchDependencies}_REJECTED`]: fetchDepsErred,
  },
  initialState
);
