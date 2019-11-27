// Copyright (c) 2019 The Jaeger Authors.
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

import React from 'react';
import { shallow } from 'enzyme';
import { Table, Tag } from 'antd';

import CohortTable, { NEED_MORE_TRACES_MESSAGE } from './CohortTable';
import TraceTimelineLink from './TraceTimelineLink';
import RelativeDate from '../../common/RelativeDate';
import TraceName from '../../common/TraceName';
import { fetchedState } from '../../../constants';
import * as dateUtils from '../../../utils/date';

const { Column } = Table;

describe('CohortTable', () => {
  const cohort = [
    {
      data: {
        traceName: 'trace name 0',
      },
      error: 'api error',
      id: 'trace-id-0',
      state: fetchedState.ERROR,
    },
    {
      id: 'trace-id-1',
    },
    {
      id: 'trace-id-2',
    },
  ];
  const selectTrace = jest.fn();
  const props = {
    cohort,
    current: cohort[0].id,
    selection: {
      [cohort[0].id]: {
        label: 'selected index 0',
      },
    },
    selectTrace,
  };

  let formatDurationSpy;
  let wrapper;

  /**
   * Creates a new wrapper with default props and specified props. It is necessary to create a new wrapper
   * when props change because enzyme does not support wrapper.setProps for classes that render an array of
   * elements.
   *
   * @param {Object} [specifiedProps={}] - Props to set that are different from props defined above.
   * @returns {Object} - New wrapper.
   */
  function updateWrapper(specifiedProps = {}) {
    wrapper = shallow(<CohortTable {...props} {...specifiedProps} />);
  }

  function getRowRenderer(dataIndex, fromData = true) {
    return wrapper
      .find(Column)
      .find(`[dataIndex="${fromData ? 'data.' : ''}${dataIndex}"]`)
      .prop('render');
  }

  beforeAll(() => {
    formatDurationSpy = jest.spyOn(dateUtils, 'formatDuration');
  });

  beforeEach(() => {
    selectTrace.mockReset();
    formatDurationSpy.mockReset();
    updateWrapper();
  });

  it('renders as expected', () => {
    expect(wrapper).toMatchSnapshot();
  });

  describe('row selection', () => {
    let rowSelection;

    function updateRowSelection() {
      rowSelection = wrapper.find(Table).prop('rowSelection');
    }

    beforeEach(() => {
      updateRowSelection();
    });

    it('defaults selectedRowKeys to empty array', () => {
      updateWrapper({ current: undefined });
      updateRowSelection();
      expect(rowSelection.selectedRowKeys).toEqual([]);
    });

    it('calls props.selectTrace on row selection', () => {
      rowSelection.onChange([cohort[1].id, cohort[2].id]);
      expect(selectTrace).toHaveBeenCalledWith(cohort[1].id);
    });

    it('calculates checkbox props for selected and current record with error', () => {
      expect(rowSelection.getCheckboxProps(cohort[0])).toEqual({ disabled: true });
    });

    it('calculates checkbox props for selected and current record without error', () => {
      expect(rowSelection.getCheckboxProps({ ...cohort[0], state: fetchedState.DONE })).toEqual({});
    });

    it('calculates checkbox props for selected but not current record without error', () => {
      updateWrapper({
        selection: {
          ...props.selecetion,
          [cohort[1].id]: {
            label: 'selected index 1',
          },
        },
      });
      updateRowSelection();
      expect(rowSelection.getCheckboxProps(cohort[1])).toEqual({ disabled: true });
    });

    it('calculates checkbox props for not selected record', () => {
      expect(rowSelection.getCheckboxProps(cohort[1])).toEqual({});
    });
  });

  it('renders shortened id', () => {
    const idRenderer = getRowRenderer('id', false);
    const traceID = 'trace-id-longer-than-eight-characters';
    const renderedId = shallow(idRenderer(traceID));
    expect(renderedId.text()).toBe(traceID.slice(0, 7));
  });

  it('renders TraceName fragment when given complete data', () => {
    const traceNameColumnRenderer = getRowRenderer('traceName');
    const testTrace = cohort[0];
    const {
      id,
      error,
      state,
      data: { traceName },
    } = testTrace;
    const renderedTraceNameColumn = shallow(
      // traceNameRenderer returns a React Fragment, wrapper div helps enzyme
      <div>{traceNameColumnRenderer('unused argument', testTrace)}</div>
    );

    const tag = renderedTraceNameColumn.find(Tag);
    expect(tag.length).toBe(1);
    expect(tag.html().includes(props.selection[id].label)).toBe(true);

    const renderedTraceName = renderedTraceNameColumn.find(TraceName);
    expect(renderedTraceName.length).toBe(1);
    expect(renderedTraceName.props()).toEqual(
      expect.objectContaining({
        error,
        state,
        traceName,
      })
    );
  });

  it('renders TraceName fragment when given minimal data', () => {
    const traceNameColumnRenderer = getRowRenderer('traceName');
    const testTrace = cohort[1];
    const renderedTraceNameColumn = shallow(
      // traceNameRenderer returns a React Fragment, wrapper div helps enzyme
      <div>{traceNameColumnRenderer('unused argument', testTrace)}</div>
    );

    expect(renderedTraceNameColumn.find(Tag).length).toBe(0);
    expect(renderedTraceNameColumn.find(TraceName).length).toBe(1);
  });

  it('renders date iff record state is fetchedState.DONE', () => {
    const dateRenderer = getRowRenderer('startTime');
    const date = 1548689901403;

    expect(dateRenderer(date, { state: fetchedState.ERROR })).toBe(false);
    const renderedDate = dateRenderer(date, { state: fetchedState.DONE });
    expect(renderedDate.type).toBe(RelativeDate);
    expect(renderedDate.props).toEqual({
      fullMonthName: true,
      includeTime: true,
      value: date / 1000,
    });
  });

  it('renders duration iff record state is fetchedState.DONE', () => {
    const durationRenderer = getRowRenderer('duration');
    const duration = 150;
    const formatDurationSpyMockReturnValue = 'formatDurationSpyMockReturnValue';
    formatDurationSpy.mockReturnValue(formatDurationSpyMockReturnValue);

    expect(durationRenderer(duration, { state: fetchedState.ERROR })).toBe(false);
    expect(formatDurationSpy).toHaveBeenCalledTimes(0);

    expect(durationRenderer(duration, { state: fetchedState.DONE })).toBe(formatDurationSpyMockReturnValue);
    expect(formatDurationSpy).toHaveBeenCalledTimes(1);
    expect(formatDurationSpy).toHaveBeenCalledWith(duration);
  });

  it('renders link', () => {
    const linkRenderer = getRowRenderer('traceID');
    const traceID = 'trace-id';
    const renderedLink = linkRenderer(traceID);
    expect(renderedLink.type).toBe(TraceTimelineLink);
    expect(renderedLink.props).toEqual({
      traceID,
    });
  });

  it('renders NEED_MORE_TRACES_MESSAGE if cohort is too small', () => {
    expect(wrapper.contains(NEED_MORE_TRACES_MESSAGE)).toBe(false);
    updateWrapper({ cohort: cohort.slice(0, 1) });
    expect(wrapper.contains(NEED_MORE_TRACES_MESSAGE)).toBe(true);
    updateWrapper({ cohort: [] });
    expect(wrapper.contains(NEED_MORE_TRACES_MESSAGE)).toBe(true);
  });
});
