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

import React from 'react';
import { shallow } from 'enzyme';

import { UnconnectedSearchResults as SearchResults } from '.';
import * as markers from './index.markers';
import * as track from './index.track';
import AltViewOptions from './AltViewOptions';
import DiffSelection from './DiffSelection';
import ResultItem from './ResultItem';
import ScatterPlot from './ScatterPlot';
import { getUrl } from '../url';
import LoadingIndicator from '../../common/LoadingIndicator';
import SearchResultsDDG from '../../DeepDependencies/traces';

describe('<SearchResults>', () => {
  let wrapper;
  let traces;
  let props;

  beforeEach(() => {
    traces = [{ traceID: 'a', spans: [], processes: {} }, { traceID: 'b', spans: [], processes: {} }];
    props = {
      diffCohort: [],
      goToTrace: () => {},
      location: {},
      loading: false,
      maxTraceDuration: 1,
      queryOfResults: {},
      traces,
    };
    wrapper = shallow(<SearchResults {...props} />);
  });

  it('shows the "no results" message when the search result is empty', () => {
    wrapper.setProps({ traces: [] });
    expect(wrapper.find(`[data-test="${markers.NO_RESULTS}"]`).length).toBe(1);
  });

  it('shows a loading indicator if loading traces', () => {
    wrapper.setProps({ loading: true });
    expect(wrapper.find(LoadingIndicator).length).toBe(1);
  });

  it('hide scatter plot if queryparam hideGraph', () => {
    wrapper.setProps({ hideGraph: true, embed: true, getSearchURL: () => 'SEARCH_URL' });
    expect(wrapper.find(ScatterPlot).length).toBe(0);
  });

  it('hide DiffSelection when disableComparisons = true', () => {
    wrapper.setProps({ disableComparisons: true });
    expect(wrapper.find(DiffSelection).length).toBe(0);
  });

  describe('search finished with results', () => {
    it('shows a scatter plot', () => {
      expect(wrapper.find(ScatterPlot).length).toBe(1);
    });

    it('shows a result entry for each trace', () => {
      expect(wrapper.find(ResultItem).length).toBe(traces.length);
    });

    describe('ddg', () => {
      const searchParam = 'view';
      const viewDdg = 'ddg';
      const viewTraces = 'traces';
      const search = `${searchParam}=${viewDdg}`;
      let trackAltViewSpy;

      beforeAll(() => {
        trackAltViewSpy = jest.spyOn(track, 'trackAltView');
      });

      it('updates url to view ddg and back and back again - and tracks changes', () => {
        const otherParam = 'param';
        const otherValue = 'value';
        const otherSearch = `?${otherParam}=${otherValue}`;
        const push = jest.fn();
        wrapper.setProps({ history: { push }, location: { search: otherSearch } });

        const toggle = wrapper.find(AltViewOptions).prop('onTraceGraphViewClicked');
        toggle();
        expect(push).toHaveBeenLastCalledWith(getUrl({ [otherParam]: otherValue, [searchParam]: viewDdg }));
        expect(trackAltViewSpy).toHaveBeenLastCalledWith(viewDdg);

        wrapper.setProps({ location: { search: `${otherSearch}&${search}` } });
        toggle();
        expect(push).toHaveBeenLastCalledWith(
          getUrl({ [otherParam]: otherValue, [searchParam]: viewTraces })
        );
        expect(trackAltViewSpy).toHaveBeenLastCalledWith(viewTraces);

        wrapper.setProps({ location: { search: `${otherSearch}&${searchParam}=${viewTraces}` } });
        toggle();
        expect(push).toHaveBeenLastCalledWith(getUrl({ [otherParam]: otherValue, [searchParam]: viewDdg }));
        expect(trackAltViewSpy).toHaveBeenLastCalledWith(viewDdg);
      });

      it('shows ddg instead of scatterplot and results', () => {
        expect(wrapper.find(SearchResultsDDG).length).toBe(0);
        expect(wrapper.find(ResultItem).length).not.toBe(0);
        expect(wrapper.find(ScatterPlot).length).not.toBe(0);

        wrapper.setProps({ location: { search: `?${search}` } });
        expect(wrapper.find(SearchResultsDDG).length).toBe(1);
        expect(wrapper.find(ResultItem).length).toBe(0);
        expect(wrapper.find(ScatterPlot).length).toBe(0);
      });
    });
  });
});
