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

import getValidState from './getValidState';

describe('getValidState', () => {
  const a = 'a string';
  const b = 'b string';
  const cohort = ['first string', 'second string', 'third string'];

  it('uses cohort kwarg when a and b are missing', () => {
    expect(getValidState({ cohort })).toEqual({
      a: cohort[0],
      b: cohort[1],
      cohort,
    });
  });

  it('uses a and b when provided', () => {
    expect(getValidState({ a, b, cohort })).toEqual({
      a,
      b,
      cohort: [a, b, ...cohort],
    });
  });

  it('uses b as a and cohort[0] for b when only b is provided', () => {
    expect(getValidState({ b, cohort })).toEqual({
      a: b,
      b: cohort[0],
      cohort: [b, ...cohort],
    });
  });
});
