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

/* eslint-disable react/require-default-props */

import React, { Component } from 'react';
import { Col, Row, Tabs } from 'antd';
import PropTypes from 'prop-types';
import queryString from 'query-string';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import store from 'store';
import memoizeOne from 'memoize-one';

import SearchForm from './SearchForm';
import SearchResults, { sortFormSelector } from './SearchResults';
import { isSameQuery, getUrl } from './url';
import * as jaegerApiActions from '../../actions/jaeger-api';
import * as fileReaderActions from '../../actions/file-reader-api';
import ErrorMessage from '../common/ErrorMessage';
import LoadingIndicator from '../common/LoadingIndicator';
import { getLocation as getTraceLocation } from '../TracePage/url';
import { actions as traceDiffActions } from '../TraceDiff/duck';
import { fetchedState } from '../../constants';
import { sortTraces } from '../../model/search';
import { stripEmbeddedState } from '../../utils/embedded-url';
import FileLoader from './FileLoader';

import './index.css';
import JaegerLogo from '../../img/jaeger-logo.svg';

const TabPane = Tabs.TabPane;

// export for tests
export class SearchTracePageImpl extends Component {
  componentDidMount() {
    const {
      diffCohort,
      fetchMultipleTraces,
      fetchServiceOperations,
      fetchServices,
      isHomepage,
      queryOfResults,
      searchTraces,
      urlQueryParams,
    } = this.props;
    if (!isHomepage && urlQueryParams && !isSameQuery(urlQueryParams, queryOfResults)) {
      searchTraces(urlQueryParams);
    }
    const needForDiffs = diffCohort.filter(ft => ft.state == null).map(ft => ft.id);
    if (needForDiffs.length) {
      fetchMultipleTraces(needForDiffs);
    }
    fetchServices();
    const { service } = store.get('lastSearch') || {};
    if (service && service !== '-') {
      fetchServiceOperations(service);
    }
  }

  goToTrace = traceID => {
    const { queryOfResults } = this.props;
    const searchUrl = queryOfResults ? getUrl(stripEmbeddedState(queryOfResults)) : getUrl();
    this.props.history.push(getTraceLocation(traceID, { fromSearch: searchUrl }));
  };

  render() {
    const {
      cohortAddTrace,
      cohortRemoveTrace,
      diffCohort,
      embedded,
      errors,
      isHomepage,
      loadingServices,
      loadingTraces,
      maxTraceDuration,
      services,
      traceResults,
      queryOfResults,
      loadJsonTraces,
    } = this.props;
    const hasTraceResults = traceResults && traceResults.length > 0;
    const showErrors = errors && !loadingTraces;
    const showLogo = isHomepage && !hasTraceResults && !loadingTraces && !errors;
    return (
      <Row className="SearchTracePage--row">
        {!embedded && (
          <Col span={6} className="SearchTracePage--column">
            <div className="SearchTracePage--find">
              <Tabs size="large">
                <TabPane tab="Search" key="searchForm">
                  {!loadingServices && services ? <SearchForm services={services} /> : <LoadingIndicator />}
                </TabPane>
                <TabPane tab="JSON File" key="fileLoader">
                  <FileLoader loadJsonTraces={loadJsonTraces} />
                </TabPane>
              </Tabs>
            </div>
          </Col>
        )}
        <Col span={!embedded ? 18 : 24} className="SearchTracePage--column">
          {showErrors && (
            <div className="js-test-error-message">
              <h2>There was an error querying for traces:</h2>
              {errors.map(err => (
                <ErrorMessage key={err.message} error={err} />
              ))}
            </div>
          )}
          {!showErrors && (
            <SearchResults
              cohortAddTrace={cohortAddTrace}
              cohortRemoveTrace={cohortRemoveTrace}
              diffCohort={diffCohort}
              disableComparisons={embedded}
              goToTrace={this.goToTrace}
              hideGraph={embedded && embedded.searchHideGraph}
              loading={loadingTraces}
              maxTraceDuration={maxTraceDuration}
              queryOfResults={queryOfResults}
              showStandaloneLink={Boolean(embedded)}
              skipMessage={isHomepage}
              traces={traceResults}
            />
          )}
          {showLogo && (
            <img
              className="SearchTracePage--logo js-test-logo"
              alt="presentation"
              src={JaegerLogo}
              width="400"
            />
          )}
        </Col>
      </Row>
    );
  }
}
SearchTracePageImpl.propTypes = {
  isHomepage: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  traceResults: PropTypes.array,
  // eslint-disable-next-line react/forbid-prop-types
  diffCohort: PropTypes.array,
  cohortAddTrace: PropTypes.func,
  cohortRemoveTrace: PropTypes.func,
  embedded: PropTypes.shape({
    searchHideGraph: PropTypes.bool,
  }),
  maxTraceDuration: PropTypes.number,
  loadingServices: PropTypes.bool,
  loadingTraces: PropTypes.bool,
  urlQueryParams: PropTypes.shape({
    service: PropTypes.string,
    limit: PropTypes.string,
  }),
  queryOfResults: PropTypes.shape({
    service: PropTypes.string,
    limit: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  services: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      operations: PropTypes.arrayOf(PropTypes.string),
    })
  ),
  searchTraces: PropTypes.func,
  history: PropTypes.shape({
    push: PropTypes.func,
  }),
  fetchMultipleTraces: PropTypes.func,
  fetchServiceOperations: PropTypes.func,
  fetchServices: PropTypes.func,
  errors: PropTypes.arrayOf(
    PropTypes.shape({
      message: PropTypes.string,
    })
  ),
  loadJsonTraces: PropTypes.func,
};

const stateTraceXformer = memoizeOne(stateTrace => {
  const { traces: traceMap, search } = stateTrace;
  const { query, results, state, error: traceError } = search;

  const loadingTraces = state === fetchedState.LOADING;
  const traces = results.map(id => traceMap[id].data);
  const maxDuration = Math.max.apply(null, traces.map(tr => tr.duration));
  return { traces, maxDuration, traceError, loadingTraces, query };
});

const stateTraceDiffXformer = memoizeOne((stateTrace, stateTraceDiff) => {
  const { traces } = stateTrace;
  const { cohort } = stateTraceDiff;
  return cohort.map(id => traces[id] || { id });
});

const sortedTracesXformer = memoizeOne((traces, sortBy) => {
  const traceResults = traces.slice();
  sortTraces(traceResults, sortBy);
  return traceResults;
});

const stateServicesXformer = memoizeOne(stateServices => {
  const {
    loading: loadingServices,
    services: serviceList,
    operationsForService: opsBySvc,
    error: serviceError,
  } = stateServices;
  const services =
    serviceList &&
    serviceList.map(name => ({
      name,
      operations: opsBySvc[name] || [],
    }));
  return { loadingServices, services, serviceError };
});

// export to test
export function mapStateToProps(state) {
  const { embedded, router, services: stServices, traceDiff } = state;
  const query = queryString.parse(router.location.search);
  const isHomepage = !Object.keys(query).length;
  const { query: queryOfResults, traces, maxDuration, traceError, loadingTraces } = stateTraceXformer(
    state.trace
  );
  const diffCohort = stateTraceDiffXformer(state.trace, traceDiff);
  const { loadingServices, services, serviceError } = stateServicesXformer(stServices);
  const errors = [];
  if (traceError) {
    errors.push(traceError);
  }
  if (serviceError) {
    errors.push(serviceError);
  }
  const sortBy = sortFormSelector(state, 'sortBy');
  const traceResults = sortedTracesXformer(traces, sortBy);
  return {
    queryOfResults,
    diffCohort,
    embedded,
    isHomepage,
    loadingServices,
    loadingTraces,
    services,
    traceResults,
    errors: errors.length ? errors : null,
    maxTraceDuration: maxDuration,
    sortTracesBy: sortBy,
    urlQueryParams: Object.keys(query).length > 0 ? query : null,
  };
}

function mapDispatchToProps(dispatch) {
  const { fetchMultipleTraces, fetchServiceOperations, fetchServices, searchTraces } = bindActionCreators(
    jaegerApiActions,
    dispatch
  );
  const { loadJsonTraces } = bindActionCreators(fileReaderActions, dispatch);
  const { cohortAddTrace, cohortRemoveTrace } = bindActionCreators(traceDiffActions, dispatch);
  return {
    cohortAddTrace,
    cohortRemoveTrace,
    fetchMultipleTraces,
    fetchServiceOperations,
    fetchServices,
    searchTraces,
    loadJsonTraces,
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SearchTracePageImpl);
