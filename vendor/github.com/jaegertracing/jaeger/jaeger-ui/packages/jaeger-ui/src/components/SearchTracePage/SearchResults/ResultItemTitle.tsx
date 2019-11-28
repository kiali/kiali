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
import { Checkbox } from 'antd';
import { Link } from 'react-router-dom';

import TraceName from '../../common/TraceName';
import { fetchedState } from '../../../constants';
import { formatDuration } from '../../../utils/date';

import { FetchedState, TNil } from '../../../types';
import { ApiError } from '../../../types/api-error';

import './ResultItemTitle.css';

type Props = {
  duration?: number;
  durationPercent?: number;
  error?: ApiError;
  isInDiffCohort: boolean;
  linkTo: string | TNil;
  state?: FetchedState | TNil;
  targetBlank?: boolean;
  toggleComparison: (traceID: string, isInDiffCohort: boolean) => void;
  traceID: string;
  traceName?: string;
  disableComparision?: boolean;
};

const DEFAULT_DURATION_PERCENT = 0;

export default class ResultItemTitle extends React.PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    disableComparision: false,
    durationPercent: DEFAULT_DURATION_PERCENT,
    error: undefined,
    state: undefined,
    targetBlank: false,
  };

  toggleComparison = () => {
    const { isInDiffCohort, toggleComparison, traceID } = this.props;
    toggleComparison(traceID, isInDiffCohort);
  };

  render() {
    const {
      disableComparision,
      duration,
      durationPercent,
      error,
      isInDiffCohort,
      linkTo,
      state,
      targetBlank,
      traceID,
      traceName,
    } = this.props;
    // Use a div when the ResultItemTitle doesn't link to anything
    let WrapperComponent: string | typeof Link = 'div';
    const wrapperProps: Record<string, string> = { className: 'ResultItemTitle--item ub-flex-auto' };
    if (linkTo) {
      wrapperProps.to = linkTo;
      WrapperComponent = Link;
      if (targetBlank) {
        wrapperProps.target = '_blank';
        wrapperProps.rel = 'noopener noreferrer';
      }
    }
    const isErred = state === fetchedState.ERROR;
    return (
      <div className="ResultItemTitle">
        {!disableComparision && (
          <Checkbox
            className="ResultItemTitle--item ub-flex-none"
            checked={!isErred && isInDiffCohort}
            disabled={isErred}
            onChange={this.toggleComparison}
          />
        )}
        {/* TODO: Shouldn't need cast */}
        <WrapperComponent {...(wrapperProps as { [key: string]: any; to: string })}>
          <span
            className="ResultItemTitle--durationBar"
            style={{ width: `${durationPercent || DEFAULT_DURATION_PERCENT}%` }}
          />
          {duration != null && <span className="ub-right ub-relative">{formatDuration(duration)}</span>}
          <h3 className="ResultItemTitle--title">
            <TraceName error={error} state={state} traceName={traceName} />
            <small className="ResultItemTitle--idExcerpt">{traceID.slice(0, 7)}</small>
          </h3>
        </WrapperComponent>
      </div>
    );
  }
}
