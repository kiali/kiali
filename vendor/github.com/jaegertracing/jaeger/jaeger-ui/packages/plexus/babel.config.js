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

function getBabelConfig(api) {
  const env = api.env();
  return {
    plugins: [
      '@babel/plugin-syntax-dynamic-import',
      [
        'babel-plugin-transform-react-remove-prop-types',
        {
          removeImport: true,
        },
      ],
      [
        '@babel/plugin-proposal-class-properties',
        {
          loose: true,
        },
      ],
    ],
    presets: [
      [
        '@babel/preset-env',
        {
          // this should match the settings in jaeger-ui/package.json
          targets: ['>0.5%', 'not dead', 'not ie <= 11', 'not op_mini all'],
        },
      ],
      [
        '@babel/preset-react',
        {
          development: env === 'development',
          useBuiltIns: true,
        },
      ],
      '@babel/preset-typescript',
    ],
  };
}

module.exports = getBabelConfig;
