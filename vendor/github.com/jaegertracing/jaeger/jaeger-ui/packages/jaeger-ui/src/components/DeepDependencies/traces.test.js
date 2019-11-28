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

import { DeepDependencyGraphPageImpl } from '.';
import { TracesDdgImpl, mapStateToProps } from './traces';
import * as url from './url';
import { ROUTE_PATH } from '../SearchTracePage/url';
import * as GraphModel from '../../model/ddg/GraphModel';
import * as transformDdgData from '../../model/ddg/transformDdgData';
import * as transformTracesToPaths from '../../model/ddg/transformTracesToPaths';

describe('TracesDdg', () => {
  it('renders DeepDependencyGraphPageImpl with specific props', () => {
    const passProps = {
      propName0: 'propValue0',
      propName1: 'propValue1',
    };
    const extraUrlArgs = ['end', 'start', 'limit', 'lookback', 'maxDuration', 'minDuration', 'view'].reduce(
      (curr, key) => ({
        ...curr,
        [key]: `test ${key}`,
      }),
      {}
    );
    const search = queryString.stringify({ ...extraUrlArgs, extraParam: 'extraParam' });

    const wrapper = shallow(<TracesDdgImpl location={{ search }} {...passProps} />);
    const ddgPage = wrapper.find(DeepDependencyGraphPageImpl);
    expect(ddgPage.props()).toEqual(
      expect.objectContaining({
        ...passProps,
        baseUrl: ROUTE_PATH,
        extraUrlArgs,
        showSvcOpsHeader: false,
      })
    );
  });

  describe('mapStateToProps()', () => {
    const hash = 'test hash';
    const mockModel = { hash };
    const mockGraph = { model: mockModel };
    const mockPayload = 'test payload';
    const urlState = {
      service: 'testService',
      operation: 'testOperation',
      visEncoding: 'testVisEncoding',
    };
    const ownProps = {
      location: {
        search: queryString.stringify(urlState),
      },
    };
    const state = {
      router: { location: ownProps.location },
      trace: {
        traces: {
          testTraceID: 'test trace data',
        },
      },
    };

    let getUrlStateSpy;
    let makeGraphSpy;
    let sanitizeUrlStateSpy;
    let spies;
    let transformDdgDataSpy;
    let transformTracesToPathsSpy;

    beforeAll(() => {
      getUrlStateSpy = jest.spyOn(url, 'getUrlState');
      makeGraphSpy = jest.spyOn(GraphModel, 'makeGraph').mockReturnValue(mockGraph);
      sanitizeUrlStateSpy = jest.spyOn(url, 'sanitizeUrlState').mockImplementation(u => u);
      transformDdgDataSpy = jest.spyOn(transformDdgData, 'default').mockReturnValue(mockModel);
      transformTracesToPathsSpy = jest.spyOn(transformTracesToPaths, 'default').mockReturnValue(mockPayload);
      spies = [
        getUrlStateSpy,
        makeGraphSpy,
        sanitizeUrlStateSpy,
        transformDdgDataSpy,
        transformTracesToPathsSpy,
      ];
    });

    beforeEach(() => {
      spies.forEach(spy => spy.mockClear());
      getUrlStateSpy.mockReturnValue(urlState);
    });

    it('gets props from url', () => {
      expect(mapStateToProps(state, ownProps)).toEqual(expect.objectContaining({ urlState }));
    });

    it('calculates graphState and graph iff service is provided', () => {
      expect(mapStateToProps(state, ownProps)).toEqual(
        expect.objectContaining({
          graph: mockGraph,
          graphState: expect.objectContaining({ model: mockModel }),
        })
      );

      const { service: _, ...urlStateWithoutService } = urlState;
      getUrlStateSpy.mockReturnValue(urlStateWithoutService);
      expect(mapStateToProps(state, ownProps)).toEqual(
        expect.objectContaining({
          graph: undefined,
          graphState: undefined,
        })
      );
    });

    it('feeds memoized functions same arguments for same url and state data', () => {
      mapStateToProps(state, ownProps);
      mapStateToProps(state, ownProps);
      spies.forEach(spy => {
        const [call0, call1] = spy.mock.calls;
        call0.forEach((arg, i) => expect(call1[i]).toBe(arg));
      });
    });

    it('sanitizes url', () => {
      mapStateToProps(state, ownProps);
      expect(sanitizeUrlStateSpy).toHaveBeenLastCalledWith(urlState, hash);
    });
  });
});
