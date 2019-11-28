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

/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */

const { join } = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

const babelConfigPath = require.resolve('./babel.config');

// Note: Do not allow *.ts files
const extensions = ['.js', '.json', '.tsx'];
const extensionsRx = /\.(js|json|tsx)$/;
const extensionsWorkerRx = /\.worker\.(js|json|tsx)$/;

function makeBaseConfig() {
  return {
    mode: 'production',
    target: 'web',
    context: __dirname,
    stats: {
      children: false,
      entrypoints: false,
      modules: false,
    },
    externals: [nodeExternals()],
    resolve: { extensions },
    module: {
      rules: [
        {
          //
          // Note: This `pre` is crucial (and not exactly obvious)
          //
          enforce: 'pre',
          test: extensionsRx,
          include: [join(__dirname, 'src'), join(__dirname, 'demo')],
          use: [
            {
              loader: 'babel-loader',
              options: {
                cacheDirectory: true,
                babelrc: false,
                configFile: babelConfigPath,
              },
            },
          ],
        },
      ],
    },
  };
}

function makeDevConfig() {
  const entry = {
    index: join(__dirname, 'demo/src/index'),
    simple: join(__dirname, 'demo/src/SimpleGraph'),
    'ux-edges': join(__dirname, 'demo/src/UxEdges'),
  };
  const config = {
    entry,
    mode: 'development',
    devtool: 'cheap-module-eval-source-map',
    output: {
      path: join(__dirname, 'build'),
      publicPath: '/',
      filename: 'assets/[name].js',
    },
    devServer: {
      port: 5000,
      hot: false,
      historyApiFallback: true,
      overlay: true,
      index: 'index',
      contentBase: join(__dirname, 'build'),
      staticOptions: {
        extensions: ['.htm', '.html'],
      },
      stats: {
        all: false,
        errors: true,
        timings: true,
        warnings: true,
      },
    },
    plugins: Object.keys(entry).map(
      name =>
        new HtmlWebpackPlugin({
          template: join(__dirname, 'demo/template.ejs'),
          appMountId: 'root',
          lang: 'en',
          meta: {
            viewport: 'width=device-width, initial-scale=1',
          },
          // intentionally omit the ".html" from the filename
          filename: `${name}`,
          chunks: [name],
          title: 'React Preview',
        })
    ),
  };

  const rules = [
    {
      test: /\.html$/,
      use: [
        {
          loader: 'html-loader',
          options: {
            attrs: ['img:src', 'link:href'],
          },
        },
      ],
    },
    {
      test: /\.css$/,
      exclude: [/\.module\.css$/],
      use: [
        {
          loader: 'style-loader',
        },
        {
          loader: 'css-loader',
          options: {
            importLoaders: 0,
          },
        },
      ],
    },
    {
      test: /\.module\.css$/,
      use: [
        {
          loader: 'style-loader',
        },
        {
          loader: 'css-loader',
          options: {
            importLoaders: 0,
            modules: true,
          },
        },
      ],
    },
    {
      test: /\.(eot|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            name: 'assets/[name].[ext]',
          },
        },
      ],
    },
    {
      test: /\.(ico|png|jpg|jpeg|gif|svg|webp)(\?v=\d+\.\d+\.\d+)?$/,
      use: [
        {
          loader: 'url-loader',
          options: {
            limit: 8192,
            name: 'assets/[name].[ext]',
          },
        },
      ],
    },
  ];
  return { config, rules };
}

function makeCommonProdConfig() {
  return {
    optimization: {
      minimize: true,
      splitChunks: false,
      runtimeChunk: false,
    },
  };
}

function makeWorkerConfig() {
  const layoutDir = join(__dirname, 'src/LayoutManager');
  const config = {
    output: {
      path: layoutDir,
      publicPath: '/',
      filename: '[name].bundled.js',
      library: 'layout.worker.bundled',
      libraryTarget: 'umd',
      umdNamedDefine: true,
    },
    entry: {
      'layout.worker': join(layoutDir, 'layout.worker.tsx'),
    },
  };
  const rules = [
    {
      test: extensionsWorkerRx,
      use: [
        {
          loader: 'worker-loader',
          options: {
            inline: true,
            fallback: false,
            name: '[name].js',
          },
        },
      ],
    },
  ];
  return { config, rules };
}

function makeUmdConfig() {
  const config = {
    ...makeCommonProdConfig(),
    output: {
      path: join(__dirname, 'dist'),
      publicPath: '/',
      filename: 'index.js',
      library: 'plexus',
      libraryTarget: 'umd',
      umdNamedDefine: true,
    },
    entry: join(__dirname, 'src/index'),
    plugins: [new CleanWebpackPlugin()],
  };
  return { config, rules: [] };
}

const FACTORIES = {
  development: makeDevConfig,
  'layout-worker': makeWorkerConfig,
  umd: makeUmdConfig,
};

function makeWebpackConfig(mode) {
  const factory = FACTORIES[mode];
  if (!factory) {
    throw new Error(`Invalid config type: ${mode}`);
  }
  const { config, rules } = factory();
  const baseConfig = makeBaseConfig();
  baseConfig.module.rules.push(...rules);
  return {
    ...baseConfig,
    ...config,
  };
}

module.exports = makeWebpackConfig;
