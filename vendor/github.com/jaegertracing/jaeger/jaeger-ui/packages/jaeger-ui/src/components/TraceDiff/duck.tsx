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

import { Action, ActionFunctionAny, createActions, handleActions } from 'redux-actions';

import TTraceDiffState from '../../types/TTraceDiffState';
import generateActionTypes from '../../utils/generate-action-types';
import guardReducer from '../../utils/guardReducer';

// payloads
type TTraceIdValue = { traceID: string };
type TNewStateValue = { newState: TTraceDiffState };
type TTraceDiffActions = {
  [actionName: string]: ActionFunctionAny<Action<TTraceIdValue | TNewStateValue>>;
};

export function newInitialState(): TTraceDiffState {
  return {
    cohort: [],
    a: null,
    b: null,
  };
}

export const actionTypes = generateActionTypes('@jaeger-ui/trace-diff', [
  'COHORT_ADD_TRACE',
  'COHORT_REMOVE_TRACE',
  'DIFF_SET_A',
  'DIFF_SET_B',
  'FORCE_STATE',
]);

const fullActions = createActions<TTraceIdValue | TNewStateValue>({
  [actionTypes.COHORT_ADD_TRACE]: (traceID: string) => ({ traceID }),
  [actionTypes.COHORT_REMOVE_TRACE]: (traceID: string) => ({ traceID }),
  [actionTypes.DIFF_SET_A]: (traceID: string) => ({ traceID }),
  [actionTypes.DIFF_SET_B]: (traceID: string) => ({ traceID }),
  [actionTypes.FORCE_STATE]: (newState: TTraceDiffState) => ({ newState }),
});

export const actions = (fullActions as any).jaegerUi.traceDiff as TTraceDiffActions;

function cohortAddTrace(state: TTraceDiffState, { traceID }: TTraceIdValue) {
  if (state.cohort.indexOf(traceID) >= 0) {
    return state;
  }
  const cohort = state.cohort.slice();
  cohort.push(traceID);
  return { ...state, cohort };
}

function cohortRemoveTrace(state: TTraceDiffState, { traceID }: TTraceIdValue) {
  const i = state.cohort.indexOf(traceID);
  if (i < 0) {
    return state;
  }
  const cohort = state.cohort.slice();
  cohort.splice(i, 1);
  const a = state.a === traceID ? null : state.a;
  const b = state.b === traceID ? null : state.b;
  return { ...state, a, b, cohort };
}

function diffSetA(state: TTraceDiffState, { traceID }: TTraceIdValue): TTraceDiffState {
  return { ...state, a: traceID };
}

function diffSetB(state: TTraceDiffState, { traceID }: TTraceIdValue): TTraceDiffState {
  return { ...state, b: traceID };
}

function forceState(state: TTraceDiffState, { newState }: TNewStateValue) {
  return newState;
}

export default handleActions<TTraceDiffState>(
  {
    [actionTypes.COHORT_ADD_TRACE]: guardReducer(cohortAddTrace),
    [actionTypes.COHORT_REMOVE_TRACE]: guardReducer(cohortRemoveTrace),
    [actionTypes.DIFF_SET_A]: guardReducer(diffSetA),
    [actionTypes.DIFF_SET_B]: guardReducer(diffSetB),
    [actionTypes.FORCE_STATE]: guardReducer(forceState),
  },
  newInitialState()
);
