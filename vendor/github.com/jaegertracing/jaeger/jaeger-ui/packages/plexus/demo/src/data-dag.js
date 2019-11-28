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

const paths = `
packages
packages/jaeger-ui
packages/jaeger-ui/build
packages/jaeger-ui/build/static
packages/jaeger-ui/build/static/css
packages/jaeger-ui/build/static/js
packages/jaeger-ui/build/static/media
packages/jaeger-ui/node_modules
packages/jaeger-ui/node_modules/.bin
packages/jaeger-ui/node_modules/bluebird
packages/jaeger-ui/node_modules/bluebird/js
packages/jaeger-ui/node_modules/bluebird/js/browser
packages/jaeger-ui/node_modules/bluebird/js/release
packages/jaeger-ui/node_modules/moment
packages/jaeger-ui/node_modules/moment/locale
packages/jaeger-ui/node_modules/moment/min
packages/jaeger-ui/node_modules/moment/src
packages/jaeger-ui/node_modules/moment/src/lib
packages/jaeger-ui/node_modules/moment/src/lib/create
packages/jaeger-ui/node_modules/moment/src/lib/duration
packages/jaeger-ui/node_modules/moment/src/lib/format
packages/jaeger-ui/node_modules/moment/src/lib/locale
packages/jaeger-ui/node_modules/moment/src/lib/moment
packages/jaeger-ui/node_modules/moment/src/lib/parse
packages/jaeger-ui/node_modules/moment/src/lib/units
packages/jaeger-ui/node_modules/moment/src/lib/utils
packages/jaeger-ui/node_modules/moment/src/locale
packages/jaeger-ui/public
packages/jaeger-ui/src
packages/jaeger-ui/src/actions
packages/jaeger-ui/src/api
packages/jaeger-ui/src/components
packages/jaeger-ui/src/components/App
packages/jaeger-ui/src/components/DependencyGraph
packages/jaeger-ui/src/components/SearchTracePage
packages/jaeger-ui/src/components/SearchTracePage/SearchResults
packages/jaeger-ui/src/components/TracePage
packages/jaeger-ui/src/components/TracePage/ArchiveNotifier
packages/jaeger-ui/src/components/TracePage/SpanGraph
packages/jaeger-ui/src/components/TracePage/TraceTimelineViewer
packages/jaeger-ui/src/components/TracePage/TraceTimelineViewer/ListView
packages/jaeger-ui/src/components/TracePage/TraceTimelineViewer/ListView/__snapshots__
packages/jaeger-ui/src/components/TracePage/TraceTimelineViewer/SpanDetail
packages/jaeger-ui/src/components/TracePage/TraceTimelineViewer/TimelineHeaderRow
packages/jaeger-ui/src/components/common
packages/jaeger-ui/src/constants
packages/jaeger-ui/src/demo
packages/jaeger-ui/src/img
packages/jaeger-ui/src/middlewares
packages/jaeger-ui/src/model
packages/jaeger-ui/src/propTypes
packages/jaeger-ui/src/reducers
packages/jaeger-ui/src/selectors
packages/jaeger-ui/src/types
packages/jaeger-ui/src/utils
packages/jaeger-ui/src/utils/DraggableManager
packages/jaeger-ui/src/utils/DraggableManager/demo
packages/jaeger-ui/src/utils/config
packages/jaeger-ui/src/utils/test
packages/jaeger-ui/src/utils/tracking
packages/plexus
packages/plexus/demo
packages/plexus/demo/dist
packages/plexus/demo/src
packages/plexus/lib
packages/plexus/lib/DirectedGraph
packages/plexus/lib/DirectedGraph/builtins
packages/plexus/lib/LayoutManager
packages/plexus/lib/LayoutManager/dot
packages/plexus/lib/types
packages/plexus/node_modules
packages/plexus/node_modules/.bin
packages/plexus/node_modules/.cache
packages/plexus/node_modules/.cache/babel-loader
packages/plexus/src
packages/plexus/src/DirectedGraph
packages/plexus/src/DirectedGraph/builtins
packages/plexus/src/LayoutManager
packages/plexus/src/LayoutManager/dot
packages/plexus/src/types
packages/plexus/umd
packages/plexus/umd/@jaegertracing
`;

export const vertices = [];
export const edges = [];

paths
  .trim()
  .split('\n')
  .forEach(line => {
    const folders = line.split('/');
    vertices.push({ key: line, label: folders.slice(-1)[0] });
    if (folders.length > 1) {
      edges.push({ from: folders.slice(0, -1).join('/'), to: line });
    }
  });
