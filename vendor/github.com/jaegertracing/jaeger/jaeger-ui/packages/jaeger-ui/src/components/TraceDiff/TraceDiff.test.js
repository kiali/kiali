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

import * as React from 'react';
import { shallow } from 'enzyme';
import queryString from 'query-string';
import * as redux from 'redux';

import { mapStateToProps, mapDispatchToProps, TraceDiffImpl } from './TraceDiff';
import TraceDiffHeader from './TraceDiffHeader';
import { actions as diffActions } from './duck';
import * as TraceDiffUrl from './url';
import * as jaegerApiActions from '../../actions/jaeger-api';
import { fetchedState, TOP_NAV_HEIGHT } from '../../constants';

describe('TraceDiff', () => {
  const defaultA = 'trace-id-a';
  const defaultB = 'trace-id-b';
  const defaultCohortIds = ['trace-id-cohort-0', 'trace-id-cohort-1', 'trace-id-cohort-2'];
  const defaultCohort = [defaultA, defaultB, ...defaultCohortIds];
  const fetchMultipleTracesMock = jest.fn();
  const forceStateMock = jest.fn();
  const historyPushMock = jest.fn();
  const defaultProps = {
    a: defaultA,
    b: defaultB,
    cohort: defaultCohort,
    fetchMultipleTraces: fetchMultipleTracesMock,
    forceState: forceStateMock,
    history: {
      push: historyPushMock,
    },
    tracesData: new Map(defaultCohort.map(id => [id, { id, state: fetchedState.DONE }])),
    traceDiffState: {
      a: defaultA,
      b: defaultB,
      cohort: defaultCohort,
    },
  };
  const newAValue = 'newAValue';
  const newBValue = 'newBValue';
  const nonDefaultCohortId = 'non-default-cohort-id';
  const getUrlSpyMockReturnValue = 'getUrlSpyMockReturnValue';
  let getUrlSpy;
  let wrapper;

  beforeAll(() => {
    getUrlSpy = jest.spyOn(TraceDiffUrl, 'getUrl').mockReturnValue(getUrlSpyMockReturnValue);
  });

  beforeEach(() => {
    fetchMultipleTracesMock.mockClear();
    forceStateMock.mockClear();
    getUrlSpy.mockClear();
    historyPushMock.mockClear();
    wrapper = shallow(<TraceDiffImpl {...defaultProps} />);
  });

  describe('syncStates', () => {
    it('forces state if a is inconsistent between url and reduxState', () => {
      wrapper.setProps({ a: newAValue });
      expect(forceStateMock).toHaveBeenLastCalledWith({
        a: newAValue,
        b: defaultProps.b,
        cohort: defaultProps.cohort,
      });
    });

    it('forces state if b is inconsistent between url and reduxState', () => {
      wrapper.setProps({ b: newBValue });
      expect(forceStateMock).toHaveBeenLastCalledWith({
        a: defaultProps.a,
        b: newBValue,
        cohort: defaultProps.cohort,
      });
    });

    it('forces state if cohort size has changed', () => {
      const newCohort = [...defaultProps.cohort, nonDefaultCohortId];
      wrapper.setProps({ cohort: newCohort });
      expect(forceStateMock).toHaveBeenLastCalledWith({
        a: defaultProps.a,
        b: defaultProps.b,
        cohort: newCohort,
      });

      wrapper.setProps({
        cohort: defaultProps.cohort,
        traceDiffState: { ...defaultProps.traceDiffState, cohort: null },
      });
      expect(forceStateMock).toHaveBeenLastCalledWith({
        a: defaultProps.a,
        b: defaultProps.b,
        cohort: defaultProps.cohort,
      });
    });

    it('forces state if cohort entry has changed', () => {
      const newCohort = [...defaultProps.cohort.slice(1), nonDefaultCohortId];
      wrapper.setProps({ cohort: newCohort });
      expect(forceStateMock).toHaveBeenLastCalledWith({
        a: defaultProps.a,
        b: defaultProps.b,
        cohort: newCohort,
      });
    });

    it('does not force state if cohorts have same values in differing orders', () => {
      wrapper.setProps({
        traceDiffState: {
          ...defaultProps.traceDiffState,
          cohort: defaultProps.traceDiffState.cohort.slice().reverse(),
        },
      });
      expect(forceStateMock).not.toHaveBeenCalled();
    });
  });

  it('requests traces lacking a state', () => {
    const newId0 = 'new-id-0';
    const newId1 = 'new-id-1';
    expect(fetchMultipleTracesMock).toHaveBeenCalledTimes(0);
    wrapper.setProps({ cohort: [...defaultProps.cohort, newId0, newId1] });
    expect(fetchMultipleTracesMock).toHaveBeenCalledWith([newId0, newId1]);
    expect(fetchMultipleTracesMock).toHaveBeenCalledTimes(1);
  });

  it('does not request traces if all traces have a state', () => {
    const newId0 = 'new-id-0';
    const newId1 = 'new-id-1';
    expect(fetchMultipleTracesMock).toHaveBeenCalledTimes(0);
    const cohort = [...defaultProps.cohort, newId0, newId1];
    const tracesData = new Map(defaultProps.tracesData);
    tracesData.set(newId0, { id: newId0, state: fetchedState.ERROR });
    tracesData.set(newId1, { id: newId0, state: fetchedState.LOADING });
    wrapper.setProps({ cohort, tracesData });
    expect(fetchMultipleTracesMock).not.toHaveBeenCalled();
  });

  it('updates url when TraceDiffHeader sets a or b', () => {
    wrapper.find(TraceDiffHeader).prop('diffSetA')(newAValue);
    expect(getUrlSpy).toHaveBeenLastCalledWith({
      a: newAValue.toLowerCase(),
      b: defaultProps.b,
      cohort: defaultProps.cohort,
    });

    wrapper.find(TraceDiffHeader).prop('diffSetB')(newBValue);
    expect(getUrlSpy).toHaveBeenLastCalledWith({
      a: defaultProps.a,
      b: newBValue.toLowerCase(),
      cohort: defaultProps.cohort,
    });

    wrapper.find(TraceDiffHeader).prop('diffSetA')('');
    expect(getUrlSpy).toHaveBeenLastCalledWith({
      a: defaultProps.a,
      b: defaultProps.b,
      cohort: defaultProps.cohort,
    });

    wrapper.find(TraceDiffHeader).prop('diffSetB')('');
    expect(getUrlSpy).toHaveBeenLastCalledWith({
      a: defaultProps.a,
      b: defaultProps.b,
      cohort: defaultProps.cohort,
    });

    expect(historyPushMock).toHaveBeenCalledTimes(4);
  });

  describe('render', () => {
    it('renders as expected', () => {
      expect(wrapper).toMatchSnapshot();
    });

    it('handles a and b not in props.tracesData', () => {
      const tracesData = new Map(defaultProps.tracesData);
      tracesData.delete(defaultA);
      tracesData.delete(defaultB);
      wrapper.setProps({ tracesData });
      expect(wrapper.find(TraceDiffHeader).props()).toEqual(
        expect.objectContaining({
          a: { id: defaultA },
          b: { id: defaultB },
        })
      );
    });

    it('handles absent a and b', () => {
      wrapper.setProps({ a: null, b: null });
      expect(wrapper.find(TraceDiffHeader).props()).toEqual(expect.objectContaining({ a: null, b: null }));
    });
  });

  describe('TraceDiff--graphWrapper top offset', () => {
    const arbitraryHeight = TOP_NAV_HEIGHT * 2;

    it('initializes as TOP_NAV_HEIGHT', () => {
      expect(wrapper.state().graphTopOffset).toBe(TOP_NAV_HEIGHT);
    });

    it('defaults to TOP_NAV_HEIGHT', () => {
      wrapper.setState({ graphTopOffset: arbitraryHeight });
      wrapper.instance().headerWrapperRef(null);
      expect(wrapper.state().graphTopOffset).toBe(TOP_NAV_HEIGHT);
    });

    it('adjusts TraceDiff--graphWrapper top offset based on TraceDiffHeader height', () => {
      wrapper.instance().headerWrapperRef({ clientHeight: arbitraryHeight });
      expect(wrapper.state().graphTopOffset).toBe(TOP_NAV_HEIGHT + arbitraryHeight);
    });
  });

  describe('mapStateToProps', () => {
    const getOwnProps = ({ a = defaultA, b = defaultB } = {}) => ({
      match: {
        params: {
          a,
          b,
        },
      },
    });
    const makeTestReduxState = ({ cohortIds = defaultCohortIds } = {}) => ({
      router: {
        location: {
          search: queryString.stringify({ cohort: cohortIds }),
        },
      },
      trace: {
        traces: cohortIds.reduce((traces, id) => ({ ...traces, [id]: { id, state: fetchedState.DONE } }), {}),
      },
      traceDiff: {
        a: 'trace-diff-a',
        b: 'trace-diff-b',
      },
    });

    it('gets a and b from ownProps', () => {
      expect(mapStateToProps(makeTestReduxState(), getOwnProps())).toEqual(
        expect.objectContaining({
          a: defaultA,
          b: defaultB,
        })
      );
    });

    it('defaults cohort to empty array if a, b, and cohort are not available', () => {
      expect(
        mapStateToProps(makeTestReduxState({ cohortIds: [] }), getOwnProps({ a: null, b: null })).cohort
      ).toEqual([]);
    });

    it('gets cohort from ownProps and state.router.location.search', () => {
      expect(mapStateToProps(makeTestReduxState(), getOwnProps()).cohort).toEqual([
        defaultA,
        defaultB,
        ...defaultCohortIds,
      ]);
    });

    it('filters falsy values from cohort', () => {
      expect(mapStateToProps(makeTestReduxState(), getOwnProps({ a: null })).cohort).toEqual([
        defaultB,
        ...defaultCohortIds,
      ]);

      expect(mapStateToProps(makeTestReduxState(), getOwnProps({ b: null })).cohort).toEqual([
        defaultA,
        ...defaultCohortIds,
      ]);

      expect(
        mapStateToProps(
          makeTestReduxState({ cohortIds: [...defaultCohortIds, '', nonDefaultCohortId] }),
          getOwnProps()
        ).cohort
      ).toEqual([defaultA, defaultB, ...defaultCohortIds, nonDefaultCohortId]);
    });

    it('filters redundant values from cohort', () => {
      expect(
        mapStateToProps(
          makeTestReduxState({ cohortIds: [...defaultCohortIds, nonDefaultCohortId] }),
          getOwnProps({ a: nonDefaultCohortId })
        ).cohort
      ).toEqual([nonDefaultCohortId, defaultB, ...defaultCohortIds]);

      expect(
        mapStateToProps(
          makeTestReduxState({ cohortIds: [...defaultCohortIds, nonDefaultCohortId] }),
          getOwnProps({ b: nonDefaultCohortId })
        ).cohort
      ).toEqual([defaultA, nonDefaultCohortId, ...defaultCohortIds]);

      expect(
        mapStateToProps(
          makeTestReduxState({ cohortIds: [...defaultCohortIds, nonDefaultCohortId, nonDefaultCohortId] }),
          getOwnProps()
        ).cohort
      ).toEqual([defaultA, defaultB, ...defaultCohortIds, nonDefaultCohortId]);
    });

    // This test may false negative if previous tests are failing
    it('builds tracesData Map from cohort and state.trace.traces', () => {
      const {
        tracesData,
        cohort: { length: expectedSize },
      } = mapStateToProps(makeTestReduxState(), getOwnProps());
      defaultCohortIds.forEach(id => {
        expect(tracesData.get(id)).toEqual({
          id,
          state: fetchedState.DONE,
        });
      });
      expect(tracesData.get(defaultA)).toEqual({
        id: defaultA,
        state: null,
      });
      expect(tracesData.get(defaultB)).toEqual({
        id: defaultB,
        state: null,
      });
      expect(tracesData.size).toBe(expectedSize);
    });

    it('includes state.traceDiff as traceDiffState', () => {
      const testReduxState = makeTestReduxState();
      const { traceDiffState } = mapStateToProps(testReduxState, getOwnProps());
      expect(traceDiffState).toBe(testReduxState.traceDiff);
    });
  });

  describe('mapDispatchToProps', () => {
    let bindActionCreatorsSpy;

    beforeAll(() => {
      bindActionCreatorsSpy = jest.spyOn(redux, 'bindActionCreators').mockImplementation(actions => {
        if (actions === jaegerApiActions) {
          return { fetchMultipleTraces: fetchMultipleTracesMock };
        }
        if (actions === diffActions) {
          return { forceState: forceStateMock };
        }
        return {};
      });
    });

    afterAll(() => {
      bindActionCreatorsSpy.mockRestore();
    });

    it('correctly binds actions to dispatch', () => {
      const dispatchMock = () => {};
      const result = mapDispatchToProps(dispatchMock);
      expect(result.fetchMultipleTraces).toBe(fetchMultipleTracesMock);
      expect(result.forceState).toBe(forceStateMock);
      expect(bindActionCreatorsSpy.mock.calls[0][1]).toBe(dispatchMock);
    });
  });
});
