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

import './node-icons.css';

export const setFocusIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="DdgNode--SetFocusIcon"
    width="100"
    height="100"
    viewBox="0 0 100 100"
  >
    <g>
      <path d="M50.0001 -1L61.0557 22.1383H38.9444L50.0001 -1Z" fill="currentColor" />
      <path d="M49.9999 99L38.9443 75.8617L61.0556 75.8617L49.9999 99Z" fill="currentColor" />
      <path d="M100 49L76.8617 60.0556L76.8617 37.9444L100 49Z" fill="currentColor" />
      <path d="M1.57361e-06 49L23.1383 37.9444L23.1383 60.0556L1.57361e-06 49Z" fill="currentColor" />
    </g>
  </svg>
);

export const focalNodeIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="100"
    height="100"
    viewBox="0 0 100 100"
    fill="none"
    style={{
      width: '45px',
      height: '45px',
    }}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M50 70.3774C61.2541 70.3774 70.3774 61.2541 70.3774 50C70.3774 38.7459 61.2541 29.6226 50 29.6226C38.7459 29.6226 29.6227 38.7459 29.6227 50C29.6227 61.2541 38.7459 70.3774 50 70.3774ZM50 66.7925C59.2742 66.7925 66.7925 59.2742 66.7925 50C66.7925 40.7258 59.2742 33.2075 50 33.2075C40.7258 33.2075 33.2076 40.7258 33.2076 50C33.2076 59.2742 40.7258 66.7925 50 66.7925Z"
      fill="#ffffff"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M60.5063 36.8994C61.4624 37.6672 62.3328 38.5376 63.1006 39.4937L72.7358 27.2642L60.5063 36.8994ZM66.3139 46.0031C66.6266 47.2841 66.7924 48.6227 66.7924 50C66.7924 51.3773 66.6266 52.7159 66.3139 53.9969L100 50L66.3139 46.0031ZM63.1006 60.5063C62.3328 61.4624 61.4624 62.3328 60.5063 63.1006L72.7358 72.7358L63.1006 60.5063ZM53.9969 66.3139C52.7159 66.6266 51.3773 66.7924 50 66.7924C48.6227 66.7924 47.2841 66.6266 46.0031 66.3139L50 100L53.9969 66.3139ZM39.4937 63.1006C38.5376 62.3328 37.6672 61.4625 36.8994 60.5063L27.2642 72.7358L39.4937 63.1006ZM33.6861 53.9969C33.3733 52.7159 33.2075 51.3773 33.2075 50C33.2075 48.6227 33.3733 47.2841 33.6861 46.0031L0 50L33.6861 53.9969ZM36.8994 39.4937L27.2642 27.2642L39.4937 36.8994C38.5376 37.6672 37.6672 38.5375 36.8994 39.4937ZM46.0031 33.6861C47.2841 33.3734 48.6227 33.2075 50 33.2075C51.3773 33.2075 52.7159 33.3734 53.9969 33.6861L50 0L46.0031 33.6861Z"
      fill="#ffffff"
    />
  </svg>
);
