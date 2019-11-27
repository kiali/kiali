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

import React, { Component } from 'react';
import createHistory from 'history/createBrowserHistory';
import { Provider } from 'react-redux';
import { Route, Redirect, Switch } from 'react-router-dom';
import { ConnectedRouter } from 'react-router-redux';

import NotFound from './NotFound';
import Page from './Page';
import DependencyGraph from '../DependencyGraph';
import { ROUTE_PATH as dependenciesPath } from '../DependencyGraph/url';
import DeepDependencies from '../DeepDependencies';
import { ROUTE_PATH as deepDependenciesPath } from '../DeepDependencies/url';
import SearchTracePage from '../SearchTracePage';
import { ROUTE_PATH as searchPath } from '../SearchTracePage/url';
import TraceDiff from '../TraceDiff';
import { ROUTE_PATH as traceDiffPath } from '../TraceDiff/url';
import TracePage from '../TracePage';
import { ROUTE_PATH as tracePath } from '../TracePage/url';
import JaegerAPI, { DEFAULT_API_ROOT } from '../../api/jaeger';
import configureStore from '../../utils/configure-store';
import processScripts from '../../utils/config/process-scripts';
import prefixUrl from '../../utils/prefix-url';

import '../common/vars.css';
import '../common/utils.css';
import './index.css';

const history = createHistory();

export default class JaegerUIApp extends Component {
  constructor(props) {
    super(props);
    this.store = configureStore(history);
    JaegerAPI.apiRoot = DEFAULT_API_ROOT;
    processScripts();
  }

  render() {
    return (
      <Provider store={this.store}>
        <ConnectedRouter history={history}>
          <Page>
            <Switch>
              <Route path={searchPath} component={SearchTracePage} />
              <Route path={traceDiffPath} component={TraceDiff} />
              <Route path={tracePath} component={TracePage} />
              <Route path={dependenciesPath} component={DependencyGraph} />
              <Route path={deepDependenciesPath} component={DeepDependencies} />

              <Redirect exact path="/" to={searchPath} />
              <Redirect exact path={prefixUrl()} to={searchPath} />
              <Redirect exact path={prefixUrl('/')} to={searchPath} />

              <Route component={NotFound} />
            </Switch>
          </Page>
        </ConnectedRouter>
      </Provider>
    );
  }
}
