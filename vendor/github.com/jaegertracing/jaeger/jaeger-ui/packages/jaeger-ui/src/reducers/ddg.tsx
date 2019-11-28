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

import { actionTypes } from '../actions/ddg';
import { fetchDeepDependencyGraph } from '../actions/jaeger-api';
import { fetchedState } from '../constants';
import { ApiError } from '../types/api-error';
import getStateEntryKey from '../model/ddg/getStateEntryKey';
import transformDdgData from '../model/ddg/transformDdgData';
import {
  EViewModifier,
  TDdgActionMeta,
  TDdgAddViewModifierPayload,
  TDdgClearViewModifiersFromIndicesPayload,
  TDdgPayload,
  TDdgRemoveViewModifierFromIndicesPayload,
  TDdgRemoveViewModifierPayload,
  TDdgViewModifierRemovalPayload,
} from '../model/ddg/types';
import TDdgState, { TDdgStateEntry } from '../types/TDdgState';
import guardReducer, { guardReducerWithMeta } from '../utils/guardReducer';

export function addViewModifier(state: TDdgState, payload: TDdgAddViewModifierPayload) {
  const { visibilityIndices, viewModifier } = payload;
  const key = getStateEntryKey(payload);
  const stateEntry: TDdgStateEntry | void = state[key];
  if (!stateEntry || stateEntry.state !== fetchedState.DONE) {
    console.warn('Cannot set view modifiers for unloaded Deep Dependency Graph'); // eslint-disable-line no-console
    return state;
  }

  const viewModifiers = new Map(stateEntry.viewModifiers);
  visibilityIndices.forEach(idx => {
    viewModifiers.set(idx, (viewModifiers.get(idx) || 0) | viewModifier); // eslint-disable-line no-bitwise
  });

  return {
    ...state,
    [key]: {
      ...stateEntry,
      viewModifiers,
    },
  };
}

export function viewModifierRemoval(state: TDdgState, payload: TDdgViewModifierRemovalPayload) {
  const { visibilityIndices, viewModifier } = payload;
  const key = getStateEntryKey(payload);
  const stateEntry: TDdgStateEntry | void = state[key];
  if (!stateEntry || stateEntry.state !== fetchedState.DONE) {
    console.warn('Cannot change view modifiers for unloaded Deep Dependency Graph'); // eslint-disable-line no-console
    return state;
  }

  const viewModifiers = new Map(stateEntry.viewModifiers);
  const indicesToUpdate = visibilityIndices || Array.from(viewModifiers.keys());

  indicesToUpdate.forEach(idx => {
    const newValue = viewModifier
      ? (viewModifiers.get(idx) || 0) & ~viewModifier // eslint-disable-line no-bitwise
      : EViewModifier.None;

    if (newValue === EViewModifier.None) {
      viewModifiers.delete(idx);
    } else {
      viewModifiers.set(idx, newValue);
    }
  });

  return {
    ...state,
    [key]: {
      ...stateEntry,
      viewModifiers,
    },
  };
}

export function fetchDeepDependencyGraphStarted(state: TDdgState, { meta }: { meta: TDdgActionMeta }) {
  const { query } = meta;
  const key = getStateEntryKey(query);
  return {
    ...state,
    [key]: {
      state: fetchedState.LOADING,
    },
  };
}

export function fetchDeepDependencyGraphDone(
  state: TDdgState,
  { meta, payload }: { meta: TDdgActionMeta; payload: TDdgPayload }
) {
  const { query } = meta;
  const { service, operation } = query;
  const key = getStateEntryKey(query);
  return {
    ...state,
    [key]: {
      model: transformDdgData(payload, { service, operation }),
      state: fetchedState.DONE,
      viewModifiers: new Map(),
    },
  };
}

export function fetchDeepDependencyGraphErred(
  state: TDdgState,
  { meta, payload }: { meta: TDdgActionMeta; payload: ApiError }
) {
  const { query } = meta;
  const key = getStateEntryKey(query);
  return {
    ...state,
    [key]: {
      error: payload,
      state: fetchedState.ERROR,
    },
  };
}

export default handleActions(
  {
    [`${fetchDeepDependencyGraph}_PENDING`]: fetchDeepDependencyGraphStarted,
    [`${fetchDeepDependencyGraph}_FULFILLED`]: guardReducerWithMeta<TDdgState, TDdgPayload, TDdgActionMeta>(
      fetchDeepDependencyGraphDone
    ),
    [`${fetchDeepDependencyGraph}_REJECTED`]: guardReducerWithMeta<TDdgState, ApiError, TDdgActionMeta>(
      fetchDeepDependencyGraphErred
    ),

    [actionTypes.ADD_VIEW_MODIFIER]: guardReducer<TDdgState, TDdgAddViewModifierPayload>(addViewModifier),
    [actionTypes.CLEAR_VIEW_MODIFIERS_FROM_INDICES]: guardReducer<
      TDdgState,
      TDdgClearViewModifiersFromIndicesPayload
    >(viewModifierRemoval),
    [actionTypes.REMOVE_VIEW_MODIFIER]: guardReducer<TDdgState, TDdgRemoveViewModifierPayload>(
      viewModifierRemoval
    ),
    [actionTypes.REMOVE_VIEW_MODIFIER_FROM_INDICES]: guardReducer<
      TDdgState,
      TDdgRemoveViewModifierFromIndicesPayload
    >(viewModifierRemoval),
  },
  {}
);
