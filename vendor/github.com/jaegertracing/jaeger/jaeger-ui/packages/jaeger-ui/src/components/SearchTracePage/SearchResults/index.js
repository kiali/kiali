// TODO: @ flow

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

import * as React from 'react';
import { Select } from 'antd';
import { History as RouterHistory, Location } from 'history';
import { Link, withRouter } from 'react-router-dom';
import { Field, formValueSelector, reduxForm } from 'redux-form';
import queryString from 'query-string';

import AltViewOptions from './AltViewOptions';
import DiffSelection from './DiffSelection';
import * as markers from './index.markers';
import { trackAltView } from './index.track';
import ResultItem from './ResultItem';
import ScatterPlot from './ScatterPlot';
import { getUrl } from '../url';
import LoadingIndicator from '../../common/LoadingIndicator';
import NewWindowIcon from '../../common/NewWindowIcon';
import SearchResultsDDG from '../../DeepDependencies/traces';
import { getLocation } from '../../TracePage/url';
import * as orderBy from '../../../model/order-by';
import { getPercentageOfDuration } from '../../../utils/date';
import { stripEmbeddedState } from '../../../utils/embedded-url';
import reduxFormFieldAdapter from '../../../utils/redux-form-field-adapter';

import type { FetchedTrace } from '../../../types';
import type { SearchQuery } from '../../../types/search';

import './index.css';

type SearchResultsProps = {
  cohortAddTrace: string => void,
  cohortRemoveTrace: string => void,
  diffCohort: FetchedTrace[],
  disableComparisons: boolean,
  goToTrace: string => void,
  hideGraph: boolean,
  history: RouterHistory,
  loading: boolean,
  location: Location,
  maxTraceDuration: number,
  queryOfResults?: SearchQuery,
  showStandaloneLink: boolean,
  skipMessage?: boolean,
  traces: TraceSummary[],
};

const Option = Select.Option;

/**
 * Contains the dropdown to sort and filter trace search results
 */
function SelectSortImpl() {
  return (
    <label>
      Sort:{' '}
      <Field name="sortBy" component={reduxFormFieldAdapter({ AntInputComponent: Select })}>
        <Option value={orderBy.MOST_RECENT}>Most Recent</Option>
        <Option value={orderBy.LONGEST_FIRST}>Longest First</Option>
        <Option value={orderBy.SHORTEST_FIRST}>Shortest First</Option>
        <Option value={orderBy.MOST_SPANS}>Most Spans</Option>
        <Option value={orderBy.LEAST_SPANS}>Least Spans</Option>
      </Field>
    </label>
  );
}

const SelectSort = reduxForm({
  form: 'traceResultsSort',
  initialValues: {
    sortBy: orderBy.MOST_RECENT,
  },
})(SelectSortImpl);

export const sortFormSelector = formValueSelector('traceResultsSort');

export class UnconnectedSearchResults extends React.PureComponent<SearchResultsProps> {
  props: SearchResultsProps;

  static defaultProps = { skipMessage: false, queryOfResults: undefined };

  toggleComparison = (traceID: string, remove: boolean) => {
    const { cohortAddTrace, cohortRemoveTrace } = this.props;
    if (remove) {
      cohortRemoveTrace(traceID);
    } else {
      cohortAddTrace(traceID);
    }
  };

  onTraceGraphViewClicked = () => {
    const { location, history } = this.props;
    const urlState = queryString.parse(location.search);
    const view = urlState.view && urlState.view === 'ddg' ? 'traces' : 'ddg';
    trackAltView(view);
    history.push(getUrl({ ...urlState, view }));
  };

  render() {
    const {
      diffCohort,
      disableComparisons,
      goToTrace,
      hideGraph,
      history,
      loading,
      location,
      maxTraceDuration,
      queryOfResults,
      showStandaloneLink,
      skipMessage,
      traces,
    } = this.props;

    const traceResultsView = queryString.parse(location.search).view !== 'ddg';

    const diffSelection = !disableComparisons && (
      <DiffSelection toggleComparison={this.toggleComparison} traces={diffCohort} />
    );
    if (loading) {
      return (
        <React.Fragment>
          {diffCohort.length > 0 && diffSelection}
          <LoadingIndicator className="u-mt-vast" centered />
        </React.Fragment>
      );
    }
    if (!Array.isArray(traces) || !traces.length) {
      return (
        <React.Fragment>
          {diffCohort.length > 0 && diffSelection}
          {!skipMessage && (
            <div className="u-simple-card" data-test={markers.NO_RESULTS}>
              No trace results. Try another query.
            </div>
          )}
        </React.Fragment>
      );
    }
    const cohortIds = new Set(diffCohort.map(datum => datum.id));
    const searchUrl = queryOfResults ? getUrl(stripEmbeddedState(queryOfResults)) : getUrl();
    return (
      <div className="SearchResults">
        <div className="SearchResults--header">
          {!hideGraph && traceResultsView && (
            <div className="ub-p3 SearchResults--headerScatterPlot">
              <ScatterPlot
                data={traces.map(t => ({
                  x: t.startTime,
                  y: t.duration,
                  traceID: t.traceID,
                  size: t.spans.length,
                  name: t.traceName,
                }))}
                onValueClick={t => {
                  goToTrace(t.traceID);
                }}
              />
            </div>
          )}
          <div className="SearchResults--headerOverview">
            <h2 className="ub-m0 u-flex-1">
              {traces.length} Trace{traces.length > 1 && 's'}
            </h2>
            {traceResultsView && <SelectSort />}
            <AltViewOptions
              traceResultsView={traceResultsView}
              onTraceGraphViewClicked={this.onTraceGraphViewClicked}
            />
            {showStandaloneLink && (
              <Link
                className="u-tx-inherit ub-nowrap ub-ml3"
                to={searchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <NewWindowIcon isLarge />
              </Link>
            )}
          </div>
        </div>
        {!traceResultsView && (
          <div className="SearchResults--ddg-container">
            <SearchResultsDDG location={location} history={history} />
          </div>
        )}
        {traceResultsView && diffSelection}
        {traceResultsView && (
          <ul className="ub-list-reset">
            {traces.map(trace => (
              <li className="ub-my3" key={trace.traceID}>
                <ResultItem
                  durationPercent={getPercentageOfDuration(trace.duration, maxTraceDuration)}
                  isInDiffCohort={cohortIds.has(trace.traceID)}
                  linkTo={getLocation(trace.traceID, { fromSearch: searchUrl })}
                  toggleComparison={this.toggleComparison}
                  trace={trace}
                  disableComparision={disableComparisons}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
}

export default withRouter(UnconnectedSearchResults);
