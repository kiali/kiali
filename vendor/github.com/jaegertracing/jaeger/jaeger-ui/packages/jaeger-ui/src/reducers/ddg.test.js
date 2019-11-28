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

import _cloneDeep from 'lodash/cloneDeep';
import _set from 'lodash/set';

import {
  addViewModifier,
  viewModifierRemoval as clearViewModifier,
  fetchDeepDependencyGraphDone,
  fetchDeepDependencyGraphErred,
  fetchDeepDependencyGraphStarted,
} from './ddg';
import { fetchedState } from '../constants';
import * as transformDdgData from '../model/ddg/transformDdgData';
import getStateEntryKey from '../model/ddg/getStateEntryKey';
import { EViewModifier } from '../model/ddg/types';

describe('deepDependencyGraph reducers', () => {
  const service = 'serviceName';
  const operation = 'operationName';
  const start = 400;
  const end = 800;
  const metaSansOp = {
    query: {
      service,
      start,
      end,
    },
  };
  const meta = {
    query: {
      ...metaSansOp.query,
      operation,
    },
  };
  const targetKey = getStateEntryKey(meta.query);
  const keySansOp = getStateEntryKey(metaSansOp.query);
  const existingState = {
    [targetKey]: 'some pre-existing state on target branch',
    [keySansOp]: 'some pre-existing state on branch without operation',
  };

  describe('retrieving deep dependency graph data', () => {
    describe('fetchDeepDependencyGraphStarted', () => {
      const expectedState = {
        state: fetchedState.LOADING,
      };

      it('indicates request is loading', () => {
        const newState = fetchDeepDependencyGraphStarted({}, { meta });
        expect(newState[targetKey]).toEqual(expectedState);
      });

      it('clears relevant exisitng state and preserves the rest', () => {
        const newState = fetchDeepDependencyGraphStarted(existingState, { meta });
        const expected = _cloneDeep(existingState);
        expected[targetKey] = expectedState;
        expect(newState).toEqual(expected);
      });

      it('handles lack of operation', () => {
        const newState = fetchDeepDependencyGraphStarted(existingState, { meta: metaSansOp });
        const expected = _cloneDeep(existingState);
        expected[keySansOp] = expectedState;
        expect(newState).toEqual(expected);
      });
    });

    describe('fetchDeepDependencyGraphErred', () => {
      const testError = new Error('Test error');
      const expectedState = {
        error: testError,
        state: fetchedState.ERROR,
      };

      it('indicates request has erred', () => {
        const newState = fetchDeepDependencyGraphErred({}, { meta, payload: testError });
        expect(newState[targetKey]).toEqual(expectedState);
      });

      it('clears relevant exisitng state and preserves the rest', () => {
        const newState = fetchDeepDependencyGraphErred(existingState, { meta, payload: testError });
        const expected = _cloneDeep(existingState);
        expected[targetKey] = expectedState;
        expect(newState).toEqual(expected);
      });

      it('handles lack of operation', () => {
        const newState = fetchDeepDependencyGraphErred(existingState, {
          meta: metaSansOp,
          payload: testError,
        });
        const expected = _cloneDeep(existingState);
        expected[keySansOp] = expectedState;
        expect(newState).toEqual(expected);
      });
    });

    describe('fetchDeepDependencyGraphDone', () => {
      const payload = { test: 'payload' };
      const mockModel = { mock: 'model' };
      const expectedState = {
        model: mockModel,
        state: fetchedState.DONE,
        viewModifiers: new Map(),
      };
      let transformSpy;

      beforeAll(() => {
        transformSpy = jest.spyOn(transformDdgData, 'default').mockImplementation(() => mockModel);
      });

      afterAll(() => {
        transformSpy.mockRestore();
      });

      it('indicates request has succeeded and transforms payload', () => {
        const newState = fetchDeepDependencyGraphDone({}, { meta, payload });
        expect(newState[targetKey]).toEqual(expectedState);
        expect(transformSpy).toHaveBeenLastCalledWith(payload, { operation, service });
      });

      it('clears relevant exisitng state and preserves the rest', () => {
        const newState = fetchDeepDependencyGraphDone(existingState, { meta, payload });
        const expected = _cloneDeep(existingState);
        expected[targetKey] = expectedState;
        expect(newState).toEqual(expected);
      });

      it('handles lack of operation', () => {
        const newState = fetchDeepDependencyGraphDone(existingState, { meta: metaSansOp, payload });
        const expected = _cloneDeep(existingState);
        expected[keySansOp] = expectedState;
        expect(newState).toEqual(expected);
        expect(transformSpy).toHaveBeenLastCalledWith(payload, { operation: undefined, service });
      });
    });
  });

  describe('managing view modifiers', () => {
    const viewModifierPath = [targetKey, 'viewModifiers'];
    const visibilityIndices = [4, 8, 15, 16, 23, 42];
    const emphasizedPayload = {
      ...meta.query,
      visibilityIndices,
      viewModifier: EViewModifier.Emphasized,
    };
    const emphasizedViewModifierMap = new Map();
    visibilityIndices.forEach(idx => emphasizedViewModifierMap.set(idx, emphasizedPayload.viewModifier));

    const selectedPayload = {
      ...meta.query,
      visibilityIndices,
      viewModifier: EViewModifier.Selected,
    };
    const selectedViewModifierMap = new Map();
    visibilityIndices.forEach(idx => selectedViewModifierMap.set(idx, selectedPayload.viewModifier));

    const multiPayload = {
      ...meta.query,
      visibilityIndices,
      viewModifier: EViewModifier.Emphasized | EViewModifier.Selected, // eslint-disable-line no-bitwise
    };
    const multiViewModifierMap = new Map();
    visibilityIndices.forEach(idx => multiViewModifierMap.set(idx, multiPayload.viewModifier));

    let emphasizedViewModifierState;
    let emptyDoneState;
    let multiViewModifierState;
    let warnSpy;

    beforeAll(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    beforeEach(() => {
      emptyDoneState = _cloneDeep(existingState);
      emptyDoneState[targetKey] = {
        state: fetchedState.DONE,
        viewModifiers: new Map(),
      };
      emphasizedViewModifierState = _set(
        _cloneDeep(emptyDoneState),
        viewModifierPath,
        emphasizedViewModifierMap
      );
      multiViewModifierState = _set(_cloneDeep(emptyDoneState), viewModifierPath, multiViewModifierMap);
    });

    afterAll(() => {
      warnSpy.mockRestore();
    });

    describe('addViewModifier', () => {
      it('warns and returns existing state if not done', () => {
        const copyOfState = _cloneDeep(existingState);
        const newState = addViewModifier(copyOfState, emphasizedPayload);
        expect(newState).toBe(copyOfState);
        expect(newState).toEqual(existingState);
        expect(warnSpy).toHaveBeenLastCalledWith(
          'Cannot set view modifiers for unloaded Deep Dependency Graph'
        );
      });

      it('adds viewModifier to state without viewModifiers', () => {
        const newState = addViewModifier(emptyDoneState, emphasizedPayload);
        const expected = _set(emptyDoneState, viewModifierPath, emphasizedViewModifierMap);
        expect(newState).not.toBe(emptyDoneState);
        expect(newState).toEqual(expected);
      });

      it('adds multilpe viewModifiers at once', () => {
        const newState = addViewModifier(emptyDoneState, multiPayload);
        const expected = _set(emptyDoneState, viewModifierPath, multiViewModifierMap);
        expect(newState).not.toBe(emptyDoneState);
        expect(newState).toEqual(expected);
      });

      it('adds provided viewModifier to existing viewModifier', () => {
        const newState = addViewModifier(emphasizedViewModifierState, selectedPayload);
        const expected = _set(emphasizedViewModifierState, viewModifierPath, multiViewModifierMap);
        expect(newState).not.toBe(emphasizedViewModifierState);
        expect(newState).toEqual(expected);
      });

      it('handles absent operation', () => {
        const operationlessDoneState = _cloneDeep(existingState);
        operationlessDoneState[keySansOp] = {
          state: fetchedState.DONE,
          viewModifiers: new Map(),
        };
        const { operation: _op, ...emphasizedPayloadWithoutOp } = emphasizedPayload;
        const newState = addViewModifier(operationlessDoneState, emphasizedPayloadWithoutOp);
        const expected = _cloneDeep(operationlessDoneState);
        expected[keySansOp].viewModifiers = emphasizedViewModifierMap;
        expect(newState).not.toBe(operationlessDoneState);
        expect(newState).toEqual(expected);
      });
    });

    describe('viewModifierRemoval', () => {
      const partialIndices = visibilityIndices.slice(0, visibilityIndices.length - 1);
      const omittedIdx = visibilityIndices[visibilityIndices.length - 1];

      it('warns and returns existing state if not done', () => {
        const copyOfState = _cloneDeep(existingState);
        const newState = clearViewModifier(copyOfState, emphasizedPayload);
        expect(newState).toBe(copyOfState);
        expect(newState).toEqual(existingState);
        expect(warnSpy).toHaveBeenLastCalledWith(
          'Cannot change view modifiers for unloaded Deep Dependency Graph'
        );
      });

      it('clears the provided viewModifier preserving other viewModifiers', () => {
        const newState = clearViewModifier(multiViewModifierState, selectedPayload);
        const expected = _set(multiViewModifierState, viewModifierPath, emphasizedViewModifierMap);
        expect(newState).not.toBe(multiViewModifierState);
        expect(newState).toEqual(expected);
      });

      it('clears provided indices if viewModifier is omitted', () => {
        const newState = clearViewModifier(multiViewModifierState, {
          ...meta.query,
          visibilityIndices: partialIndices,
        });
        const expectedMap = new Map([[omittedIdx, multiPayload.viewModifier]]);
        const expected = _set(multiViewModifierState, viewModifierPath, expectedMap);
        expect(newState).not.toBe(multiViewModifierState);
        expect(newState).toEqual(expected);
      });

      it('clears provided viewModifier from all indices if visibilityIndices array is omitted', () => {
        const newState = clearViewModifier(multiViewModifierState, {
          ...meta.query,
          viewModifier: EViewModifier.Selected,
        });
        const expected = _set(multiViewModifierState, viewModifierPath, emphasizedViewModifierMap);
        expect(newState).not.toBe(multiViewModifierState);
        expect(newState).toEqual(expected);
      });

      it('removes indices that become 0', () => {
        const mixedViewModifierMap = new Map(multiViewModifierMap);
        for (let i = 0; i < partialIndices.length - 1; i++) {
          mixedViewModifierMap.set(partialIndices[i], EViewModifier.Emphasized);
        }
        const mixedViewModifierState = _set(
          _cloneDeep(emptyDoneState),
          viewModifierPath,
          mixedViewModifierMap
        );
        const newState = clearViewModifier(mixedViewModifierState, {
          ...meta.query,
          visibilityIndices: partialIndices,
          viewModifier: EViewModifier.Emphasized,
        });
        const expectedMap = new Map([
          [partialIndices[partialIndices.length - 1], EViewModifier.Selected],
          [omittedIdx, multiPayload.viewModifier],
        ]);
        const expected = _set(mixedViewModifierState, viewModifierPath, expectedMap);
        expect(newState).not.toBe(mixedViewModifierState);
        expect(newState).toEqual(expected);
      });

      it('does not add previously absent idx if included in payload', () => {
        const partialViewModifierMap = new Map();
        for (let i = 0; i < partialIndices.length; i++) {
          partialViewModifierMap.set(partialIndices[i], EViewModifier.Emphasized);
        }
        const partialViewModifierState = _set(
          _cloneDeep(emptyDoneState),
          viewModifierPath,
          partialViewModifierMap
        );
        const newState = clearViewModifier(partialViewModifierState, emphasizedPayload);
        const expected = _set(partialViewModifierState, viewModifierPath, new Map());
        expect(newState).not.toBe(partialViewModifierState);
        expect(newState).toEqual(expected);
      });

      it('handles absent operation', () => {
        const operationlessViewModifierState = _cloneDeep(existingState);
        operationlessViewModifierState[keySansOp] = {
          state: fetchedState.DONE,
          viewModifiers: multiViewModifierMap,
        };
        const { operation: _op, ...selectedPayloadWithoutState } = selectedPayload;
        const newState = clearViewModifier(operationlessViewModifierState, selectedPayloadWithoutState);
        const expected = _cloneDeep(operationlessViewModifierState);
        expected[keySansOp].viewModifiers = emphasizedViewModifierMap;
        expect(newState).not.toBe(operationlessViewModifierState);
        expect(newState).toEqual(expected);
      });
    });
  });
});
