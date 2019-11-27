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

/* eslint-disable import/no-extraneous-dependencies */
const fs = require('fs');
const { addBabelPlugin, addLessLoader } = require('customize-cra');
const lessToJs = require('less-vars-to-js');

function useEslintRc(config) {
  const { rules } = config.module;
  const preRule = rules.find(rule => rule.enforce === 'pre');
  if (!preRule) {
    throw new Error('Unable to find estlint rule, pre');
  }
  const use = Array.isArray(preRule.use) ? preRule.use[0] : null;
  if (!use) {
    throw new Error('Unable to find estlint rule, use');
  }
  const isEslintRule = /node_modules\/eslint-loader\//.test(use.loader);
  if (!isEslintRule || !use.options) {
    throw new Error('Unable to find estlint rule, eslint loader');
  }
  use.options.useEslintrc = true;
  return config;
}

// Convert less vars to JS
const loadedVarOverrides = fs.readFileSync('config-overrides-antd-vars.less', 'utf8');
const modifyVars = lessToJs(loadedVarOverrides);

function webpack(_config) {
  let config = _config;
  config = addLessLoader({
    modifyVars,
    javascriptEnabled: true,
  })(config);
  config = addBabelPlugin(['import', { libraryName: 'antd', style: true }])(config);
  useEslintRc(config);
  return config;
}

module.exports = { webpack };
