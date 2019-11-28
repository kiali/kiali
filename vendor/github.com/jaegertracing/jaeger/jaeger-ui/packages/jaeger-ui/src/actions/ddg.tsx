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

import _identity from 'lodash/identity';
import { createActions, ActionFunctionAny, Action } from 'redux-actions';

import {
  TDdgAddViewModifierPayload,
  TDdgClearViewModifiersFromIndicesPayload,
  TDdgRemoveViewModifierFromIndicesPayload,
  TDdgRemoveViewModifierPayload,
  TDdgViewModifierRemovalPayload,
} from '../model/ddg/types';
import generateActionTypes from '../utils/generate-action-types';

export const actionTypes = generateActionTypes('@jaeger-ui/DEEP-DEPENDENCY-GRAPH', [
  'ADD_VIEW_MODIFIER',
  'CLEAR_VIEW_MODIFIERS_FROM_INDICES',
  'REMOVE_VIEW_MODIFIER',
  'REMOVE_VIEW_MODIFIER_FROM_INDICES',
]);

const addViewModifier: (kwarg: TDdgAddViewModifierPayload) => TDdgAddViewModifierPayload = _identity;
const clearViewModifiersFromIndices: (
  kwarg: TDdgClearViewModifiersFromIndicesPayload
) => TDdgClearViewModifiersFromIndicesPayload = _identity;
const removeViewModifier: (kwarg: TDdgRemoveViewModifierPayload) => TDdgRemoveViewModifierPayload = _identity;
const removeViewModifierFromIndices: (
  kwarg: TDdgRemoveViewModifierFromIndicesPayload
) => TDdgRemoveViewModifierFromIndicesPayload = _identity;

const fullActions = createActions<TDdgAddViewModifierPayload | TDdgViewModifierRemovalPayload>({
  [actionTypes.ADD_VIEW_MODIFIER]: addViewModifier,
  [actionTypes.CLEAR_VIEW_MODIFIERS_FROM_INDICES]: clearViewModifiersFromIndices,
  [actionTypes.REMOVE_VIEW_MODIFIER]: removeViewModifier,
  [actionTypes.REMOVE_VIEW_MODIFIER_FROM_INDICES]: removeViewModifierFromIndices,
});

export default (fullActions as any).jaegerUi.deepDependencyGraph as Record<
  string,
  ActionFunctionAny<Action<TDdgViewModifierRemovalPayload>>
>;
