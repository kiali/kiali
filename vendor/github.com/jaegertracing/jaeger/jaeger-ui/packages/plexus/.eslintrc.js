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

// This file configures eslint for TypeScript, which will be used for this
// directory and all subdirectories.

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: '.',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    // placed after '@typescript-eslint/recommended' so TS formatting rules
    // that conflict with prettier rules are overriden
    'prettier/@typescript-eslint',
  ],
  rules: {
    // use @typescript-eslint/no-useless-constructor to avoid null error on *.d.ts files
    'no-useless-constructor': 0,

    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/explicit-member-accessibility': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-useless-constructor': 1,
    '@typescript-eslint/prefer-interface': 0,
  },
};
