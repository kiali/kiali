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

/* eslint-disable import/first */
jest.mock('store');

import React from 'react';
import { shallow } from 'enzyme';
import moment from 'moment';
import queryString from 'query-string';
import store from 'store';

import {
  convertQueryParamsToFormDates,
  convTagsLogfmt,
  getUnixTimeStampInMSFromForm,
  lookbackToTimestamp,
  mapStateToProps,
  optionsWithinMaxLookback,
  submitForm,
  traceIDsToQuery,
  SearchFormImpl as SearchForm,
  validateDurationFields,
} from './SearchForm';
import * as markers from './SearchForm.markers';

function makeDateParams(dateOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dateOffset || 0);
  date.setSeconds(0);
  date.setMilliseconds(0);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateStr = [date.getFullYear(), '-', month < 10 ? '0' : '', month, '-', day < 10 ? '0' : '', day].join(
    ''
  );
  return {
    date,
    dateStr,
    dateTimeStr: date.toTimeString().slice(0, 5),
  };
}

const DATE_FORMAT = 'YYYY-MM-DD';
const TIME_FORMAT = 'HH:mm';
const defaultProps = {
  dataCenters: ['dc1'],
  searchMaxLookback: {
    label: '2 Days',
    value: '2d',
  },
  services: [{ name: 'svcA', operations: ['A', 'B'] }, { name: 'svcB', operations: ['A', 'B'] }],
};

describe('conversion utils', () => {
  describe('getUnixTimeStampInMSFromForm()', () => {
    it('converts correctly', () => {
      const { date: startSrc, dateStr: startDate, dateTimeStr: startDateTime } = makeDateParams(-1);
      const { date: endSrc, dateStr: endDate, dateTimeStr: endDateTime } = makeDateParams(0);
      const { start, end } = getUnixTimeStampInMSFromForm({
        startDate,
        startDateTime,
        endDate,
        endDateTime,
      });
      expect(start).toBe(`${startSrc.valueOf()}000`);
      expect(end).toBe(`${endSrc.valueOf()}000`);
    });
  });

  describe('convertQueryParamsToFormDates()', () => {
    it('converts correctly', () => {
      const startMoment = moment().subtract(1, 'day');
      const endMoment = moment();
      const params = {
        start: `${startMoment.valueOf()}000`,
        end: `${endMoment.valueOf()}000`,
      };

      const {
        queryStartDate,
        queryStartDateTime,
        queryEndDate,
        queryEndDateTime,
      } = convertQueryParamsToFormDates(params);
      expect(queryStartDate).toBe(startMoment.format(DATE_FORMAT));
      expect(queryStartDateTime).toBe(startMoment.format(TIME_FORMAT));
      expect(queryEndDate).toBe(endMoment.format(DATE_FORMAT));
      expect(queryEndDateTime).toBe(endMoment.format(TIME_FORMAT));
    });
  });

  describe('convTagsLogfmt()', () => {
    it('converts logfmt formatted string to JSON', () => {
      const input = 'http.status_code=404 span.kind=client key="with a long value"';
      const target = JSON.stringify({
        'http.status_code': '404',
        'span.kind': 'client',
        key: 'with a long value',
      });
      expect(convTagsLogfmt(input)).toBe(target);
    });

    // https://github.com/jaegertracing/jaeger/issues/550#issuecomment-352850811
    it('converts all values to strings', () => {
      const input = 'aBoolKey error=true num=9';
      const target = JSON.stringify({
        aBoolKey: 'true',
        error: 'true',
        num: '9',
      });
      expect(convTagsLogfmt(input)).toBe(target);
    });
  });

  describe('traceIDsToQuery()', () => {
    it('splits on ","', () => {
      const strs = ['a', 'b', 'c'];
      expect(traceIDsToQuery(strs.join(','))).toEqual(strs);
    });
  });
});

describe('lookback utils', () => {
  describe('lookbackToTimestamp', () => {
    const hourInMicroseconds = 60 * 60 * 1000 * 1000;
    const now = new Date();
    const nowInMicroseconds = now * 1000;

    it('creates timestamp for hours ago', () => {
      [1, 2, 4, 7].forEach(lookbackNum => {
        expect(nowInMicroseconds - lookbackToTimestamp(`${lookbackNum}h`, now)).toBe(
          lookbackNum * hourInMicroseconds
        );
      });
    });

    it('creates timestamp for days ago', () => {
      [1, 2, 4, 7].forEach(lookbackNum => {
        expect(nowInMicroseconds - lookbackToTimestamp(`${lookbackNum}d`, now)).toBe(
          lookbackNum * 24 * hourInMicroseconds
        );
      });
    });

    it('creates timestamp for weeks ago', () => {
      [1, 2, 4, 7].forEach(lookbackNum => {
        expect(nowInMicroseconds - lookbackToTimestamp(`${lookbackNum}w`, now)).toBe(
          lookbackNum * 7 * 24 * hourInMicroseconds
        );
      });
    });
  });

  describe('optionsWithinMaxLookback', () => {
    const threeHoursOfExpectedOptions = [
      {
        label: 'Hour',
        value: '1h',
      },
      {
        label: '2 Hours',
        value: '2h',
      },
      {
        label: '3 Hours',
        value: '3h',
      },
    ];

    it('memoizes correctly', () => {
      const firstCallOptions = optionsWithinMaxLookback(threeHoursOfExpectedOptions[0]);
      const secondCallOptions = optionsWithinMaxLookback(threeHoursOfExpectedOptions[0]);
      const thirdCallOptions = optionsWithinMaxLookback(threeHoursOfExpectedOptions[1]);
      expect(secondCallOptions).toBe(firstCallOptions);
      expect(thirdCallOptions).not.toBe(firstCallOptions);
    });

    it('returns options within config.search.maxLookback', () => {
      const configValue = threeHoursOfExpectedOptions[2];
      const options = optionsWithinMaxLookback(configValue);

      expect(options.length).toBe(threeHoursOfExpectedOptions.length);
      options.forEach(({ props }, i) => {
        expect(props.value).toBe(threeHoursOfExpectedOptions[i].value);
        expect(props.children[1]).toBe(threeHoursOfExpectedOptions[i].label);
      });
    });

    it("includes config.search.maxLookback if it's not part of standard options", () => {
      const configValue = {
        label: '4 Hours - configValue',
        value: '4h',
      };
      const expectedOptions = [...threeHoursOfExpectedOptions, configValue];
      const options = optionsWithinMaxLookback(configValue);

      expect(options.length).toBe(expectedOptions.length);
      options.forEach(({ props }, i) => {
        expect(props.value).toBe(expectedOptions[i].value);
        expect(props.children[1]).toBe(expectedOptions[i].label);
      });
    });

    it('uses config.search.maxLookback in place of standard option it is not equal to but is equivalent to', () => {
      const configValue = {
        label: '180 minutes is equivalent to 3 hours',
        value: '180m',
      };
      const expectedOptions = [threeHoursOfExpectedOptions[0], threeHoursOfExpectedOptions[1], configValue];
      const options = optionsWithinMaxLookback(configValue);

      expect(options.length).toBe(expectedOptions.length);
      options.forEach(({ props }, i) => {
        expect(props.value).toBe(expectedOptions[i].value);
        expect(props.children[1]).toBe(expectedOptions[i].label);
      });
    });
  });
});

describe('submitForm()', () => {
  const LOOKBACK_VALUE = 2;
  const LOOKBACK_UNIT = 's';
  let searchTraces;
  let fields;

  beforeEach(() => {
    searchTraces = jest.fn();
    fields = {
      lookback: `${LOOKBACK_VALUE}${LOOKBACK_UNIT}`,
      operation: 'op-a',
      resultsLimit: 20,
      service: 'svc-a',
    };
  });

  it('ignores `fields.operation` when it is "all"', () => {
    fields.operation = 'all';
    submitForm(fields, searchTraces);
    const { calls } = searchTraces.mock;
    expect(calls.length).toBe(1);
    const { operation } = calls[0][0];
    expect(operation).toBe(undefined);
  });

  describe('`fields.lookback`', () => {
    function getCalledDuration(mock) {
      const { start, end } = mock.calls[0][0];
      const diffMs = (Number(end) - Number(start)) / 1000;
      return moment.duration(diffMs);
    }

    it('subtracts `lookback` from `fields.end`', () => {
      submitForm(fields, searchTraces);
      expect(searchTraces).toHaveBeenCalledTimes(1);
      expect(getCalledDuration(searchTraces.mock).asSeconds()).toBe(LOOKBACK_VALUE);
    });

    it('parses `lookback` double digit options', () => {
      const lookbackDoubleDigitValue = 12;
      fields.lookback = `${lookbackDoubleDigitValue}h`;
      submitForm(fields, searchTraces);
      expect(searchTraces).toHaveBeenCalledTimes(1);
      expect(getCalledDuration(searchTraces.mock).asHours()).toBe(lookbackDoubleDigitValue);
    });

    it('processes form dates when `lookback` is "custom"', () => {
      const { date: startSrc, dateStr: startDate, dateTimeStr: startDateTime } = makeDateParams(-1);
      const { date: endSrc, dateStr: endDate, dateTimeStr: endDateTime } = makeDateParams(0);
      fields = {
        ...fields,
        startDate,
        startDateTime,
        endDate,
        endDateTime,
        lookback: 'custom',
      };
      submitForm(fields, searchTraces);
      const { calls } = searchTraces.mock;
      expect(calls.length).toBe(1);
      const { start, end } = calls[0][0];
      expect(start).toBe(`${startSrc.valueOf()}000`);
      expect(end).toBe(`${endSrc.valueOf()}000`);
    });
  });

  describe('`fields.tags`', () => {
    it('is ignored when `fields.tags` is falsy', () => {
      fields.tags = undefined;
      submitForm(fields, searchTraces);
      const { calls } = searchTraces.mock;
      expect(calls.length).toBe(1);
      const { tag } = calls[0][0];
      expect(tag).toBe(undefined);
    });

    it('is parsed when `fields.tags` is truthy', () => {
      const input = 'http.status_code=404 span.kind=client key="with a long value"';
      const target = JSON.stringify({
        'http.status_code': '404',
        'span.kind': 'client',
        key: 'with a long value',
      });
      fields.tags = input;
      submitForm(fields, searchTraces);
      const { calls } = searchTraces.mock;
      expect(calls.length).toBe(1);
      const { tags } = calls[0][0];
      expect(tags).toEqual(target);
    });
  });

  describe('`fields.{minDuration,maxDuration}', () => {
    it('retains values as-is when they are truthy', () => {
      fields.minDuration = 'some-min';
      fields.maxDuration = 'some-max';
      submitForm(fields, searchTraces);
      const { calls } = searchTraces.mock;
      expect(calls.length).toBe(1);
      const { minDuration, maxDuration } = calls[0][0];
      expect(minDuration).toBe(fields.minDuration);
      expect(maxDuration).toBe(fields.maxDuration);
    });

    it('omits values when they are falsy', () => {
      fields.minDuation = undefined;
      fields.maxDuation = undefined;
      submitForm(fields, searchTraces);
      const { calls } = searchTraces.mock;
      expect(calls.length).toBe(1);
      const { minDuration, maxDuration } = calls[0][0];
      expect(minDuration).toBe(null);
      expect(maxDuration).toBe(null);
    });
  });
});

describe('<SearchForm>', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = shallow(<SearchForm {...defaultProps} />);
  });

  it('enables operations only when a service is selected', () => {
    let ops = wrapper.find('[placeholder="Select An Operation"]');
    expect(ops.prop('props').disabled).toBe(true);
    wrapper = shallow(<SearchForm {...defaultProps} selectedService="svcA" />);
    ops = wrapper.find('[placeholder="Select An Operation"]');
    expect(ops.prop('props').disabled).toBe(false);
  });

  it('shows custom date inputs when `props.selectedLookback` is "custom"', () => {
    function getDateFieldLengths(compWrapper) {
      return [
        compWrapper.find('[placeholder="Start Date"]').length,
        compWrapper.find('[placeholder="End Date"]').length,
      ];
    }
    expect(getDateFieldLengths(wrapper)).toEqual([0, 0]);
    wrapper = shallow(<SearchForm {...defaultProps} selectedLookback="custom" />);
    expect(getDateFieldLengths(wrapper)).toEqual([1, 1]);
  });

  it('disables the submit button when a service is not selected', () => {
    let btn = wrapper.find(`[data-test="${markers.SUBMIT_BTN}"]`);
    expect(btn.prop('disabled')).toBeTruthy();
    wrapper = shallow(<SearchForm {...defaultProps} selectedService="svcA" />);
    btn = wrapper.find(`[data-test="${markers.SUBMIT_BTN}"]`);
    expect(btn.prop('disabled')).toBeFalsy();
  });

  it('disables the submit button when the form has invalid data', () => {
    wrapper = shallow(<SearchForm {...defaultProps} selectedService="svcA" />);
    let btn = wrapper.find(`[data-test="${markers.SUBMIT_BTN}"]`);
    // If this test fails on the following expect statement, this may be a false negative caused by a separate
    // regression.
    expect(btn.prop('disabled')).toBeFalsy();
    wrapper.setProps({ invalid: true });
    btn = wrapper.find(`[data-test="${markers.SUBMIT_BTN}"]`);
    expect(btn.prop('disabled')).toBeTruthy();
  });
});

describe('validation', () => {
  it('should return `undefined` if the value is falsy', () => {
    expect(validateDurationFields('')).toBeUndefined();
    expect(validateDurationFields(null)).toBeUndefined();
    expect(validateDurationFields(undefined)).toBeUndefined();
  });

  it('should return Popover-compliant error object if the value is a populated string that does not adhere to expected format', () => {
    expect(validateDurationFields('100')).toEqual({
      content: 'Please enter a number followed by a duration unit, e.g. 1.2s, 100ms, 500us',
      title: 'Please match the requested format.',
    });
  });

  it('should return `undefined` if the value is a populated string that adheres to expected format', () => {
    expect(validateDurationFields('100ms')).toBeUndefined();
  });
});

describe('mapStateToProps()', () => {
  let state;

  beforeEach(() => {
    state = { router: { location: { serach: '' } } };
  });

  it('does not explode when the query string is empty', () => {
    expect(() => mapStateToProps(state)).not.toThrow();
  });

  // tests the green path
  it('service and operation fallback to values in `store` when the values are valid', () => {
    const oldStoreGet = store.get;
    const op = 'some-op';
    const svc = 'some-svc';
    state.services = {
      services: [svc, 'something-else'],
      operationsForService: {
        [svc]: [op, 'some other opertion'],
      },
    };
    store.get = () => ({ operation: op, service: svc });
    const { service, operation } = mapStateToProps(state).initialValues;
    expect(operation).toBe(op);
    expect(service).toBe(svc);
    store.get = oldStoreGet;
  });

  describe('deriving values from `state.router.location.search`', () => {
    let params;
    let expected;

    beforeEach(() => {
      const { date: startSrc, dateStr: startDate, dateTimeStr: startDateTime } = makeDateParams(-1);
      const { date: endSrc, dateStr: endDate, dateTimeStr: endDateTime } = makeDateParams(0);
      const tagsJSON = '{"error":"true","span.kind":"client"}';
      const tagsLogfmt = 'error=true span.kind=client';
      const common = {
        lookback: '2h',
        maxDuration: null,
        minDuration: null,
        operation: 'Driver::findNearest',
        service: 'driver',
      };
      params = {
        ...common,
        end: `${endSrc.valueOf()}000`,
        limit: '999',
        start: `${startSrc.valueOf()}000`,
        tags: tagsJSON,
      };
      expected = {
        ...common,
        endDate,
        endDateTime,
        startDate,
        startDateTime,
        resultsLimit: params.limit,
        tags: tagsLogfmt,
        traceIDs: null,
      };
    });

    it('derives values when available', () => {
      state.router.location.search = queryString.stringify(params);
      expect(mapStateToProps(state).initialValues).toEqual(expected);
    });

    it('parses `tag` values in the former format to logfmt', () => {
      delete params.tags;
      params.tag = ['error:true', 'span.kind:client'];
      state.router.location.search = queryString.stringify(params);
      expect(mapStateToProps(state).initialValues).toEqual(expected);
    });
  });

  it('fallsback to default values', () => {
    // convert time string to number of minutes in day
    function msDiff(aDate, aTime, bDate, bTime) {
      const a = new Date(`${aDate}T${aTime}`);
      const b = new Date(`${bDate}T${bTime}`);
      return Math.abs(a - b);
    }
    const dateParams = makeDateParams(0);
    const { startDate, startDateTime, endDate, endDateTime, ...values } = mapStateToProps(
      state
    ).initialValues;

    expect(values).toEqual({
      service: '-',
      resultsLimit: 20,
      lookback: '1h',
      operation: 'all',
      tags: undefined,
      minDuration: null,
      maxDuration: null,
      traceIDs: null,
    });
    expect(startDate).toBe(dateParams.dateStr);
    expect(startDateTime).toBe('00:00');
    // expect the time differential between our `makeDateparams()` and the mapStateToProps values to be
    // within 60 seconds (CI tests run slowly)
    expect(msDiff(dateParams.dateStr, '00:00', startDate, startDateTime)).toBeLessThan(60 * 1000);
    expect(msDiff(dateParams.dateStr, dateParams.dateTimeStr, endDate, endDateTime)).toBeLessThan(60 * 1000);
  });
});
