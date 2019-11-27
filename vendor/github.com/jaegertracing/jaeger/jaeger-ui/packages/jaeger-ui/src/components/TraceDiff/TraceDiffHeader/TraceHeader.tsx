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
import IoChevronDown from 'react-icons/lib/io/chevron-down';

import TraceTimelineLink from './TraceTimelineLink';
import RelativeDate from '../../common/RelativeDate';
import TraceName from '../../common/TraceName';
import { fetchedState } from '../../../constants';
import { formatDuration } from '../../../utils/date';

import { FetchedState, TNil } from '../../../types';
import { ApiError } from '../../../types/api-error';

import './TraceHeader.css';

type Props = {
  duration: number | TNil;
  error?: ApiError;
  startTime: number | TNil;
  state: FetchedState | TNil;
  traceID: string | TNil;
  traceName: string | TNil;
  totalSpans: number | TNil;
};

type AttrsProps = {
  startTime: number | TNil;
  duration: number | TNil;
  totalSpans: number | TNil;
};

// exported for tests
export function EmptyAttrs() {
  return (
    <ul className="TraecDiffHeader--traceAttributes">
      <li className="TraecDiffHeader--traceAttr">&nbsp;</li>
    </ul>
  );
}

// exported for tests
export function Attrs(props: AttrsProps) {
  const { startTime, duration, totalSpans } = props;
  return (
    <ul className="TraecDiffHeader--traceAttributes">
      <li className="TraecDiffHeader--traceAttr">
        <strong>
          <RelativeDate value={(startTime || 0) / 1000} includeTime fullMonthName />
        </strong>
      </li>
      <li className="TraecDiffHeader--traceAttr">
        <span className="u-tx-muted">Duration: </span>
        <strong>{formatDuration(duration || 0)}</strong>
      </li>
      <li className="TraecDiffHeader--traceAttr">
        <span className="u-tx-muted">Spans: </span> <strong>{totalSpans || 0}</strong>
      </li>
    </ul>
  );
}

export default function TraceHeader(props: Props) {
  const { duration, error, startTime, state, traceID, totalSpans, traceName } = props;
  const AttrsComponent = state === fetchedState.DONE ? Attrs : EmptyAttrs;
  return (
    <div className="TraecDiffHeader--traceHeader">
      <h1 className="TraecDiffHeader--traceTitle">
        <span>
          {traceID ? (
            <React.Fragment>
              <TraceName key="name" traceName={traceName} error={error} state={state} />{' '}
              <small key="id" className="u-tx-muted ub-pr2">
                {traceID.slice(0, 7)}
              </small>
              <TraceTimelineLink traceID={traceID} />
            </React.Fragment>
          ) : (
            <span className="u-tx-muted">Select a Trace...</span>
          )}
        </span>
        <IoChevronDown className="TraecDiffHeader--traceTitleChevron" />
      </h1>
      <AttrsComponent startTime={startTime} duration={duration} totalSpans={totalSpans} />
    </div>
  );
}

TraceHeader.defaultProps = {
  error: undefined,
};
