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
import _get from 'lodash/get';
import memoizeOne from 'memoize-one';
import queryString from 'query-string';
import { connect } from 'react-redux';

import { DeepDependencyGraphPageImpl, TOwnProps, TProps, TReduxProps } from '.';
import { getUrlState, sanitizeUrlState } from './url';
import { ROUTE_PATH } from '../SearchTracePage/url';
import GraphModel, { makeGraph } from '../../model/ddg/GraphModel';
import { fetchedState } from '../../constants';
import { extractUiFindFromState } from '../common/UiFindInput';
import transformDdgData from '../../model/ddg/transformDdgData';
import transformTracesToPaths from '../../model/ddg/transformTracesToPaths';

import { TDdgStateEntry } from '../../types/TDdgState';
import { ReduxState } from '../../types';

// Required for proper memoization of subsequent function calls
const svcOp = memoizeOne((service, operation) => ({ service, operation }));

// export for tests
export function mapStateToProps(state: ReduxState, ownProps: TOwnProps): TReduxProps {
  const urlState = getUrlState(ownProps.location.search);
  const { density, operation, service, showOp } = urlState;
  let graphState: TDdgStateEntry | undefined;
  let graph: GraphModel | undefined;
  if (service) {
    const payload = transformTracesToPaths(state.trace.traces, service, operation);
    graphState = {
      model: transformDdgData(payload, svcOp(service, operation)),
      state: fetchedState.DONE,
      viewModifiers: new Map(),
    };
    graph = makeGraph(graphState.model, showOp, density);
  }

  return {
    graph,
    graphState,
    urlState: sanitizeUrlState(urlState, _get(graphState, 'model.hash')),
    ...extractUiFindFromState(state),
  };
}

// export for tests
export class TracesDdgImpl extends React.PureComponent<TProps & { showSvcOpsHeader: never; baseUrl: never }> {
  render(): React.ReactNode {
    const { location } = this.props;
    const urlArgs = queryString.parse(location.search);
    const { end, start, limit, lookback, maxDuration, minDuration, view } = urlArgs;
    const extraArgs = { end, start, limit, lookback, maxDuration, minDuration, view };
    return (
      <DeepDependencyGraphPageImpl
        baseUrl={ROUTE_PATH}
        extraUrlArgs={extraArgs}
        showSvcOpsHeader={false}
        {...this.props}
      />
    );
  }
}

export default connect(mapStateToProps)(TracesDdgImpl);
