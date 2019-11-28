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

import { createStore } from 'redux';

import reducer, { actions, newInitialState } from './duck';

describe('TraceDiff/duck', () => {
  const initialCohort = ['trace-id-0', 'trace-id-1', 'trace-id-2'];
  const newTraceId = 'new-trace-id';
  let store;

  beforeEach(() => {
    store = createStore(reducer, {
      a: initialCohort[0],
      b: initialCohort[1],
      cohort: initialCohort,
    });
  });

  describe('newInitialState', () => {
    it('creates an empty set', () => {
      expect(newInitialState()).toEqual({
        a: null,
        b: null,
        cohort: [],
      });
    });
  });

  describe('cohortAddTrace', () => {
    it('adds trace that does not already exist in state', () => {
      const oldCohort = store.getState().cohort;
      expect(oldCohort.includes(newTraceId)).toBe(false);

      store.dispatch(actions.cohortAddTrace(newTraceId));
      const newCohort = store.getState().cohort;
      expect(newCohort).not.toBe(oldCohort);
      expect(newCohort.includes(newTraceId)).toBe(true);
      expect(newCohort).toEqual(expect.arrayContaining(oldCohort));
    });

    it('returns original state if traceID already exists in state', () => {
      const state = store.getState();
      store.dispatch(actions.cohortAddTrace(initialCohort[0]));
      expect(store.getState()).toBe(state);
    });
  });

  describe('cohortRemoveTrace', () => {
    it('removes trace that exists in state.cohort', () => {
      const oldCohort = store.getState().cohort;
      store.dispatch(actions.cohortRemoveTrace(initialCohort[2]));
      const newCohort = store.getState().cohort;
      expect(newCohort).not.toBe(oldCohort);
      expect(newCohort.includes(initialCohort[2])).toBe(false);
      expect(newCohort).toEqual(oldCohort.slice(0, 2));
    });

    it('removes state.a', () => {
      const oldState = store.getState();
      const oldCohort = oldState.cohort;
      store.dispatch(actions.cohortRemoveTrace(oldState.a));
      const newState = store.getState();
      const newCohort = newState.cohort;
      expect(newState.a).toBe(null);
      expect(newCohort).not.toBe(oldCohort);
      expect(newCohort.includes(oldState.a)).toBe(false);
      expect(newCohort).toEqual(oldCohort.slice(1));
    });

    it('removes state.b', () => {
      const oldState = store.getState();
      const oldCohort = oldState.cohort;
      store.dispatch(actions.cohortRemoveTrace(oldState.b));
      const newState = store.getState();
      const newCohort = newState.cohort;
      expect(newState.b).toBe(null);
      expect(newCohort).not.toBe(oldCohort);
      expect(newCohort.includes(oldState.b)).toBe(false);
      expect(newCohort).toEqual(oldCohort.filter(entry => entry !== oldState.b));
    });

    it('returns original state if traceID already exists in state', () => {
      const state = store.getState();
      store.dispatch(actions.cohortRemoveTrace(newTraceId));
      expect(store.getState()).toBe(state);
    });
  });

  describe('diffSetA', () => {
    it('set a to provided traceId', () => {
      const oldState = store.getState();
      store.dispatch(actions.diffSetA(newTraceId));
      const newState = store.getState();
      expect(newState).not.toBe(oldState);
      expect(newState).toEqual({
        ...oldState,
        a: newTraceId,
      });
    });
  });

  describe('diffSetB', () => {
    it('set b to provided traceId', () => {
      const oldState = store.getState();
      store.dispatch(actions.diffSetB(newTraceId));
      const newState = store.getState();
      expect(newState).not.toBe(oldState);
      expect(newState).toEqual({
        ...oldState,
        b: newTraceId,
      });
    });
  });

  describe('forceState', () => {
    it('returns given state', () => {
      const newState = newInitialState();
      store.dispatch(actions.forceState(newState));
      expect(store.getState()).toBe(newState);
    });
  });
});
