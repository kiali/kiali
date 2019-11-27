# plexus

A React component for directed graphs.

![NPM @jaegertracing/plexus](https://img.shields.io/npm/v/@jaegertracing/plexus?color=08979c&style=for-the-badge&labelColor=444) ![Apache 2.0 License](https://img.shields.io/npm/l/@jaegertracing/plexus?color=096dd9&style=for-the-badge&labelColor=444&label=)

<!-- pro-tip: Generate the TOC here at https://magnetikonline.github.io/markdown-toc-generate/ -->

- [About](#about)
- [Install](#install)
- [Quick start](#quick-start)
  - [Import](#import)
  - [Data](#data)
  - [LayoutManager](#layoutmanager)
  - [Digraph](#digraph)
  - [Result](#result)
- [Concepts](#concepts)
  - [Edge and vertex data](#edge-and-vertex-data)
  - [Layers](#layers)
  - [Measurable nodes](#measurable-nodes)
  - [Layers group](#layers-group)
  - [`setOn*` props factories](#seton-props-factories)
- [API](#api)
  - [Input](#input)
    - [TVertexKey](#tvertexkey)
    - [TVertex](#tvertex)
    - [TEdge](#tedge)
  - [Data augmented with layout information](#data-augmented-with-layout-information)
    - [TLayoutVertex](#tlayoutvertex)
    - [TLayoutEdge](#tlayoutedge)
    - [TLayoutGraph](#tlayoutgraph)
  - [Externally exposed graph state](#externally-exposed-graph-state)
    - [TRendererUtils](#trendererutils)
    - [TExposedGraphState](#texposedgraphstate)
    - [TContainerPropsSetter](#tcontainerpropssetter)
  - [`LayoutManager` options](#layoutmanager-options)
  - [`Digraph` props](#digraph-props)
  - [Layer configuration objects](#layer-configuration-objects)
    - [Common to all layers](#common-to-all-layers)
    - [Common to SVG layers, only](#common-to-svg-layers-only)
    - [Measurable nodes layer](#measurable-nodes-layer)
    - [Nodes layer](#nodes-layer)
    - [Edges layer](#edges-layer)
    - [HTML and SVG layers group](#html-and-svg-layers-group)
  - [Builtin props factories](#builtin-props-factories)
    - [classNameIsSmall](#classnameissmall)
    - [scaleProperty.opacity](#scalepropertyopacity)
    - [scaleProperty.strokeOpacity](#scalepropertystrokeopacity)
    - [scaleProperty](#scaleproperty)
- [Recipes](#recipes)
  - [Arrow heads](#arrow-heads)
  - [UX + edges](#ux--edges)

## About

We needed to render directed graphs in Jaeger UI for the trace comparison feature and the experimental Trace Graph view. So, we surveyed the options available for generating directed graphs, in JavaScript. Our considerations included:

- The more readable the graphs, the better
- Try not to step outside of React
- Complex layouts within nodes should be supported
- We should not need to specify the width and height of nodes (but, resizing nodes doesn't need to be supported)
- We want lots of options for styling and adding interactivity

We found the landscape to be very impressive, but none of the existing options seemed to fit our key takeaways:

- The venerable [GraphViz](https://graphviz.gitlab.io/) does a fantastic job with layouts, i.e. positioning nodes and routing edges
- Regarding complex layouts within nodes, using HTML is second nature while things get complicated fast with SVG or canvas and GraphViz is not sufficiently expressive for our needs
- React is great for things like defining and managing interactivity and creating and styling complex layouts, so let's leverage it as much as we can

The approach we've taken is pretty much a main-line of the points above:

- Use GraphViz to determine node positions and route edges
- Use React for everything else

To break this down a bit further:

- GraphViz
  - Generally the `dot` layout engine in GraphViz is all we need for generating graph layouts
  - Sometimes it makes sense to use `dot` to position nodes, only, and use `neato` to route edges
- React
  - Use HTML to render content within nodes
  - Use SVG to render edges
  - Use either HTML or SVG to render supplemental layers of graph elements
  - Use standard React patterns for adding interactivity

The excellent [viz.js](https://github.com/mdaines/viz.js) is used, in a WebWorker, to generate GraphViz as plain-text output which is then parsed and provided to a React component which does the rendering.

**Note:** The viz.js repository on GitHub is archived.However, it still works great. And, likely could be even better if we upgrade to the last published version ([#339](https://github.com/jaegertracing/jaeger-ui/issues/339)).

## Install

```bash
# Yarn
yarn add @jaegertracing/plexus

# NPM
npm install --save @jaegertracing/plexus
```

## Quick start

### Import

```tsx
import * as React from 'react';

import { LayoutManager } from 'plexus';
// TODO(joe): Update import after killing `DirectedGraph`
import Digraph from 'plexus/Digraph';
```

### Data

For each node in the graph you need to define an object with a `key` field that uniquely identifies the node. We'll call this a vertex object. The vertices can have additional fields; below we've added `name` fields to our vertices.

```tsx
const vertices = [
  { key: 'web', name: 'web-app : login' },
  { key: 'users', name: 'user-store : get-user' },
  { key: 'cache', name: 'cache : get' },
  { key: 'db', name: 'db : get-user' },
  { key: 'auth', name: 'auth : login' },
];
```

For each edge in the graph, you need to define an object with `to` and `from` fields, the value of which map to the `key` fields on the vertices. This defines the which vertex is the head and which is the tail. Edges objects can have additional fields.

```tsx
// Edges must refer to the `key` field of vertices.
const edges = [
  { from: 'web', to: 'users' },
  { from: 'web', to: 'auth' },
  { from: 'users', to: 'cache' },
  { from: 'users', to: 'db' },
];
```

### `LayoutManager`

The LayoutManager generates the layout for the graph, i.e. it determines the node positions and the paths of the edges. Options can be passed that will affect the layout. See [`LayoutManager` options](#layoutmanager-options) for details.

```tsx
const lm = new LayoutManager({ useDotEdges: true, rankdir: 'TB', ranksep: 1.1 });
```

### `Digraph`

The bulk of the public API is the `Digraph` component.

Below, we use the `Digraph` component to create a graph from the `vertices` and `edges` we defined, above. We set some styles, pass in the `LayoutManager` and configure the layers of the graph.

```tsx
const simpleGraph = (
  <Digraph
    edges={edges}
    vertices={vertices}
    setOnGraph={{
      style: {
        fontFamily: 'sans-serif',
        height: '100%',
        position: 'fixed',
        width: '100%',
      },
    }}
    layoutManager={lm}
    measurableNodesKey="nodes"
    layers={[
      {
        key: 'edges',
        edges: true,
        layerType: 'svg',
        defs: [{ localId: 'edge-arrow' }],
        markerEndId: 'edge-arrow',
      },
      {
        key: 'nodes',
        layerType: 'html',
        measurable: true,
        renderNode: (vertex: TVertex) => vertex.name,
        setOnNode: { style: { padding: '1rem', whiteSpace: 'nowrap', background: '#e8e8e8' } },
      },
    ]}
  />
);

render(simpleGraph, document.querySelector('#root'));
```

### Result

Combined, the above code snippets render the following graph:

![alt text](media/SimpleGraph.png 'SimpleGraph')

## Concepts

The elements of a plexus graph are defined as a series of layers. These establish how the nodes and edges will be rendered. A layer can generate either HTML elements or SVG elements and can render either nodes or edges. Each type of element, i.e. nodes or edges, can be represented by more than one layer.

plexus uses [GraphViz](https://graphviz.gitlab.io/) (via the [viz.js](https://github.com/mdaines/viz.js) package) to generate the layout for graphs. This layout information is then combined with the edge and vertex data and passed to the layers for rendering.

The life cycle of a graph in plexus is as following:

1. Render the nodes (but do not show them) with an initial position of `0, 0`
1. Measure the nodes so their size can be accounted for
1. Generate the layout of the graph
1. Render the layers of elements

In step 1, we render nodes but they are not shown to the user. This set of nodes is used to determine the width and height of each node so their sizes can be accounted for by GraphViz. This layer is unique in that it must be able to render nodes without knowing anything about the layout of the graph. We can say this layer of nodes is _measurable_, and every plexus graph requires one measurable node layer.

Steps 2 and 3 happen behind the scenes and we can basically ignore them. (The layout does have some configuration options that are covered, below.)

Step 4 is where we bring the graph to life.

### Edge and vertex data

Within plexus, each vertex must be uniquely identified by a `key` field of type either `string` or `number`. This must be unique within the vertices of a given graph. Edges refer to these keys.

```tsx
type TVertexKey = string | number;

// TODO(jeo): change the default type in types/index.tsx
type TVertex<T = Record<string, unknown>> = T & {
  key: TVertexKey;
};

type TEdge<T = Record<string, unknown>> = T & {
  from: TVertexKey;
  to: TVertexKey;
};
```

The data underlying edges and vertices are arrays of these types:

```tsx
// type is TVertex<{ name: string }>
const vertices = [
  { key: 'web', name: 'web-app : login' },
  { key: 'users', name: 'user-store : get-user' },
  // etc...
];

// type is simply TEdge<{}>
const edges = [
  { from: 'web', to: 'users' },
  { from: 'web', to: 'auth' },
  // etc...
];
```

### Layers

There are three types of layers:

- Edges
- Nodes
- Measurable nodes

Layers are configured through plain JavaScript objects and the `layers` prop on the `Digraph` component.

A layer can generate either HTML elements or SVG elements but **not a combination** of the two.

**Note:** We didn't see a practical reason to support edge layers that generate HTML. So, only SVG is supported for edge layers, at this time.

Layers have a containing element to group the elements they render. For HTML layers this is a `div`; for SVG layers this is a `g`.

The ordering of layers in the document matches the order in which they're defined in the `layers` prop on the `Digraph`.

### Measurable nodes

As noted in the description of the lifecycle, **every plexus graph must contain one measurable nodes layer**. This layer is rendered before the layout is generated so the size of the nodes can be accounted for in the layout.

This layer can be either HTML or SVG, and the value of the layer's `key` must also be set to the `measurableNodesKey` prop on the `Digraph` component.

By default, the size of a node is based on the dimensions of the wrapper for the node after it's been rendered to the document: a `div` for HTML nodes and a `g` for SVG nodes. This default behavior can be overridden via the `measureNode` field on the layer configuration object.

### Layers group

Layers can be grouped by their type: HTML or SVG. This is mainly only relevant if `zoom` is enabled or if you want to set props on a common container element for several layers. If `zoom` is enabled, the zoom transform will be applied to the common container of the layers instead of to each individual layer.

**Note:** Nesting groups is not supported.

### `setOn*` props factories

plexus provides hooks to define or generate props for the elements in the graph and their containers. For instance, the `setOnGraph` prop of the `Digraph` component allows props to be defined or generated for the root `<div>` element of the graph.

Generally, the value of these can be either an object of props to set on the target element, a function which will generate either `null` or an object of props to set on the target, or an array of either of these.

```tsx
const graphClassName = { className: 'LeGraphOlogy' };
// ignoring the parameters that are passed to the factory function, for now...
const generatePaddingStyle = () => {
  style: {
    padding: `${(Math.random() * 10).toFixed()}px`;
  }
};

// All three of these are valid:

// Set only the CSS class
const ok = (
  <Digraph
    edges={edges}
    vertices={vertices}
    setOnGraph={graphClassName}
    // etc...
  />
);

// Set only the random padding
const alsoOk = (
  <Digraph
    edges={edges}
    vertices={vertices}
    setOnGraph={generatePaddingStyle}
    // etc...
  />
);

// Set both the CSS class and the random padding
const allOfTheAbove = (
  <Digraph
    edges={edges}
    vertices={vertices}
    setOnGraph={[graphClassName, generatePaddingStyle]}
    // etc...
  />
);
```

## API

- [Input](#input)
  - [TVertexKey](#tvertexkey)
  - [TVertex](#tvertex)
  - [TEdge](#tedge)
- [Data augmented with layout information](#data-augmented-with-layout-information)
  - [TLayoutVertex](#tlayoutvertex)
  - [TLayoutEdge](#tlayoutedge)
  - [TLayoutGraph](#tlayoutgraph)
- [Externally exposed graph state](#externally-exposed-graph-state)
  - [TRendererUtils](#trendererutils)
  - [TExposedGraphState](#texposedgraphstate)
  - [TContainerPropsSetter](#tcontainerpropssetter)
- [`LayoutManager` options](#layoutmanager-options)
- [`Digraph` props](#digraph-props)
- [Layer configuration objects](#layer-configuration-objects)
  - [Common to all layers](#common-to-all-layers)
  - [Common to SVG layers, only](#common-to-svg-layers-only)
  - [Measurable nodes layer](#measurable-nodes-layer)
  - [Nodes layer](#nodes-layer)
  - [Edges layer](#edges-layer)
  - [HTML and SVG layers group](#html-and-svg-layers-group)
- [Builtin props factories](#builtin-props-factories)
  - [classNameIsSmall](#classnameissmall)
  - [scaleProperty.opacity](#scalepropertyopacity)
  - [scaleProperty.strokeOpacity](#scalepropertystrokeopacity)
  - [scaleProperty](#scaleproperty)

### Input

#### `TVertexKey`

The type for the `key` field on vertices.

```tsx
type TVertexKey = string;
```

#### `TVertex`

The type for the data underlying vertices.

```tsx
type TVertex<T = {}> = T & {
  key: TVertexKey;
};
```

#### `TEdge`

The data that underlies edges in a graph.

```tsx
type TEdge<T = {}> = T & {
  from: TVertexKey;
  to: TVertexKey;
  isBidirectional?: boolean;
};
```

### Data augmented with layout information

#### `TLayoutVertex`

The underlying vertex data with layout information for a given vertex.

```tsx
type TLayoutVertex<T = {}> = {
  vertex: TVertex<T>;
  height: number;
  left: number;
  top: number;
  width: number;
};
```

#### `TLayoutEdge`

The combination of the underlying edge data (for a single edge) and the path information for a given edge.

```tsx
type TLayoutEdge<T = {}> = {
  edge: TEdge<T>;
  pathPoints: [number, number][];
};
```

#### `TLayoutGraph`

Indicates the size and scale of the full graph after it's been laid out.

```tsx
type TLayoutGraph = {
  height: number;
  scale: number;
  width: number;
};
```

### Externally exposed graph state

Various aspects of the state of the plexus graph are made available to props factories and render functions.

#### `TRendererUtils`

These utils are made available to the props factories (`setOn...`) and the render fields of the layer configuration objects.

The specific object which serves as the `TRendererUtils` that is made available does not change; referential equality is maintained throughout the life of a plexus graph. Therefore, these utils don't trigger updates to components (such as when the zoom transform changes).

| Field | Type and description |
| :-- | :-- |
| getLocalId | `(name: string) => string` |
|  | Takes in a string and prefixes it to scope the string to the current plexus graph. This effectively allows for IDs that are unique within the document given the `name` parameter is unique within a graph.<br>&nbsp; |
| getZoomTransform | `() => ZoomTransform` |
|  | Returns the current D3 zoom transform. See <https://github.com/d3/d3-zoom#zoom-transforms> for details.<br><br>**Note:** A reference to this function can be used to access the current zoom, at any time. For instance, if we have a node that shows a normal scale view of itself on hover, this function can be used to restrict the hover effect to only happen when the graph is actually at a reduced scale.<br>&nbsp; |

#### `TExposedGraphState`

This type gives access to the graph's current state, such as the current phase or the layout vertices. This is available to the container-level prop factories and the render field for `TDefEntry` elements of SVG layer configurations.

| Field | Type and description |
| :-- | :-- |
| edges | `TEdge[]` |
|  | The user provided edge data underlying the edges in the graph.<br>&nbsp; |
| layoutEdges | `TLayoutEdge[] \| null` |
|  | The edge data and the layout data. This is `null` if the layout is not yet generated.<br>&nbsp; |
| layoutGraph | `TLayoutGraph \| null` |
|  | The dimensions of the graph. `null` if the layout is not yet generated.<br>&nbsp; |
| layoutPhase | `ELayoutPhase` |
|  | The current phase of the graph.<br>&nbsp; |
| layoutVertices | `TLayoutVertex[] \| null` |
|  | The vertex data and the layout data. This is `null` if the layout is not yet generated.<br>&nbsp; |
| renderUtils | `TRendererUtils` |
|  | Utils for converting an ID local to the graph to globally unique in the document and fetching the current zoom transform.<br>&nbsp; |
| vertices | `TVertex[]` |
|  | The user provided vertex data underlying the nodes in the graph.<br>&nbsp; |
| zoomTransform | `ZoomTransform` |
|  | The current zoom transform on the graph.<br>&nbsp; |

`ELayoutPhase` is an enum of the phases of the graph layout process.

```tsx
enum ELayoutPhase {
  NoData = 'NoData',
  CalcSizes = 'CalcSizes',
  CalcPositions = 'CalcPositions',
  CalcEdges = 'CalcEdges',
  Done = 'Done',
}
```

#### `TContainerPropsSetter`

The type of the props factories for containers that allows props to be defined or generated.

This type is either a static collection of props to set on the container, a factory function to generate props (or `null`), or an array of either of these values.

```tsx
type TContainerPropsSetter =
  | Record<string, unknown>
  | ((input: TExposedGraphState) => Record<string, unknown> | null)
  | (Record<string, unknown> | ((input: TExposedGraphState) => Record<string, unknown> | null))[];
```

### `LayoutManager` options

The `LayoutManager` supports the following configuration options:

| Name | Type and description |
| :-- | :-- |
| totalMemory | `number` |
|  | This affects the total memeory available for the GraphViz Emscripten module instance. It's useful if you're hitting memory allocation errors. See [`totalMemory` reference](<https://github.com/mdaines/viz.js/wiki/API-(1.x)#totalmemory-option>). The value should be a power of two.<br>&nbsp; |
| useDotEdges | `boolean = false` |
|  | When `true` the dot edges are used; i.e. generating neato edge paths is skipped.<br>&nbsp; |
| splines | `string = "true"` |
|  | GraphViz [splines](https://www.graphviz.org/doc/info/attrs.html#d:splines) graph attribute.<br>&nbsp; |
| sep | `number = 0.5` |
|  | GraphViz [sep](https://www.graphviz.org/doc/info/attrs.html#d:sep) graph attribute, which defines the space margin around nodes.<br>&nbsp; |
| rankdir | `'TB' \| 'LR' \| 'BT' \| 'RL' = 'LR'` |
|  | GraphViz [rankdir](https://www.graphviz.org/doc/info/attrs.html#d:rankdir) graph attribute, which defines the orientation of the layout.<br>&nbsp; |
| ranksep | `number = 5` |
|  | GraphViz [ranksep](https://www.graphviz.org/doc/info/attrs.html#d:ranksep) graph attribute, which defines the minimum distance between levels of nodes.<br>&nbsp; |
| nodesep | `number = 1.5` |
|  | GraphViz [nodesep](https://www.graphviz.org/doc/info/attrs.html#d:nodesep) graph attribute, which establishes the minimum distance between two adjacent nodes in the same level.<br>&nbsp; |

### `Digraph` props

| Name | Type and description |
| :-- | :-- |
| className | `string` |
|  | Added to the root-most `div` for the graph<br>&nbsp; |
| classNamePrefix | `string = "plexus"` |
|  | Applied as a CSS class and a prefix to element specific CSS classes for all elements within the graph.<br>&nbsp; |
| edges | `TEdge[]` |
|  | **Required**<br>The data underlying the edges in the graph.<br>&nbsp; |
| layers | `TLayer[]` |
|  | **Required**<br>The layers configuration. See below for details.<br>&nbsp; |
| layoutManager | `LayoutManager` |
|  | **Required**<br>The `LayoutManager` for this graph. Each graph should have it's own instance.<br>&nbsp; |
| measurableNodesKey | `string` |
|  | **Required**<br>This should be the `key` of the measurable nodes layer. **It is required and will throw a runtime error if the key from the measurable nodes layer does not match this prop.**<br>&nbsp; |
| minimap | `boolean` |
|  | Boolean flag to enable the minimap. If enabled, the `minimapClassName` should be set to something that will style it. \*\*The minimap has no builtin styling.<br>&nbsp; |
| minimapClassName | `string` |
|  | Added to the root-most container on the minimap.<br>&nbsp; |
| setOnGraph | `TContainerPropsSetter` |
|  | An optional prop that allows props to be defined for the root-most `div` element of the graph.<br>&nbsp; |
| style | `React.CSSProperties` |
|  | Set on the root-most container `div`.<br>&nbsp; |
| vertices | `TVertex[]` |
|  | **Required**<br>The data underlying the vertices in the graph.<br>&nbsp; |
| zoom | `boolean` |
|  | Boolean flag to enable zoom and pan.<br>&nbsp; |

### Layer configuration objects

#### Common to all layers

Configuration fields common to all layers.

| Name | Type and description |
| :-- | :-- |
| layerType | `"html" \| "svg"` |
|  | **Required**<br>Indicates the type of elements the layer will render. This determines the type of the container the elements are grouped into.<br><br>**Note:** This field is not required (or even allowed) on layers that are within HTML or SVG layers group. The layer inherits the value from the group.<br>&nbsp; |
| key | `string` |
|  | **Required**<br>This is used as the `key` prop on the resultant JSX and is required on all layers or layer groups.<br>&nbsp; |
| setOnContainer | `TContainerPropsSetter` |
|  | An optional field that allows props to be defined or generated for the container element of the layer.<br>&nbsp; |

#### Common to SVG layers, only

This configuration field is available only on SVG layers.

| Name | Type and description |
| :-- | :-- |
| defs | `TDefEntry[]` _See below for details on the `TDefEntry` type._ |
|  | `defs` allows you to add elements to a [`<defs>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/defs) within an SVG layer or group of SVG layers. The main use of `defs` is to define markers for the edges. See `TDefEntry`, below, for details on configuring `defs`.<br>&nbsp; |

The `TDefEntry` type is defined as follows:

| Field | Type and description |
| :-- | :-- |
| localId | `string` |
|  | **Required**<br>The ID part that must be unique within a graph. `localId` be unique within a `Digraph` instance. `localId` will then be prefixed with an ID that is unique to the instance `Digraph`, resulting in the final ID which is unique within the document. This final ID is then passed to `renderEntry` as the third argument.<br>&nbsp; |
| renderEntry | `TRenderDefEntryFn` _See below for details on the function signature._ |
|  | Provide a render function for the element that will be added to the `<defs>`.<br><br>**Note:** The fallback `renderEntry` function (i.e. the default value for this field) will return a `<marker>` suitable to be the `marker-end` reference on an edge's `<path>`. This `<marker>` will result in an arrow head.<br>&nbsp; |
| setOnEntry | `TContainerPropsSetter` |
|  | Specify props to be passed as the second argument to the `renderEntry` function. See [`TContainerPropsSetter`](#tcontainerpropssetter) for details on this field's type.<br>&nbsp; |

And, the signature for the `renderEntry` function is:

```tsx
type TRenderDefEntryFn = (
  graphState: TExposedGraphState,
  entryProps: Record<string, unknown> | null,
  id: string
) => React.ReactElement;
```

|  | Argument | Type and description |
| :-: | :-- | :-- |
| 0 | graphState | `TExposedGraphState` |
|  |  | The current state of the graph. See [`TExposedGraphState`](#texposedgraphstate) for details.<br>&nbsp; |
| 1 | entryProps | `Record<string, unknown> | null` |
|  |  | The the result of evaluating `setOnEntry`.<br>&nbsp; |
| 2 | id | `string` |
|  |  | An ID, unique within the document, to be applied to the root-most element being returned from `renderEntry`.<br>&nbsp; |

#### Measurable nodes layer

`Digraph` **requires one measurable nodes layer.**

In addition to the common layer configuration fields, the following fields are also available:

| Name | Type and description |
| :-- | :-- |
| measurable | `true` |
|  | **Required**<br>Indicates the layer of nodes should be used for determining the size of the nodes.<br>&nbsp; |
| setOnNode | `TMeasurableNodePropsSetter` _See below for details on this type._ |
|  | Allows props to be defined or generated for the container of the node. This is a `<div>` for HTML layers and a `<g>` for SVG layers. **Note:** The resultant props are applied to the container element; they are not passed on to the `renderNode` factory.<br>&nbsp; |
| renderNode | `TRenderMeasurableNodeFn` _See below for details on this type._ |
|  | **Required**<br>A factory function that is used to generate nodes from the `vertices` prop on the `Digraph` component. The generated node will be used to determine the size of the nodes, which is taken into account when laying out the graph. `renderNode` is invoked for each `TVertex`. The `TLayoutVertex` will be `null` until the graph layout is available. This function will have access to the `TRenderUtils`, which means it can access the current zoom transform, but it is not redrawn when the zoom transform changes.<br>&nbsp; |
| measureNode | `TMeasureNodeFn` _See below for details on this type._ |
|  | Overrides the default measuring of nodes.<br>&nbsp; |

The types for `setOnNode` and `renderNode` are distinct from the corresponding fields on a non-measurable nodes layer in that the first argument is the `TVertex`, and the `TLayoutVertex` argument is **only available after initial render**.

The type for `setOnNode` is similar to that of `setOnContainer` in that the value can also be either an object of props, a factory function, or an array of either.

```tsx
type TMeasurableNodePropsSetter =
  | Record<string, unknown>
  | TMeasurableNodePropsFn
  | (TMeasurableNodePropsFn | Record<string, unknown>)[];

type TMeasurableNodePropsFn = (
  vertex: TVertex,
  utils: TRendererUtils,
  layoutVertex: TLayoutVertex | null
) => Record<string, unknown> | null;
```

The type for the `renderNode` field.

```tsx
type TRenderMeasurableNodeFn = (
  vertex: TVertex,
  utils: TRendererUtils,
  layoutVertex: TLayoutVertex | null
) => React.ReactNode;
```

The type for `measureNode`.

```tsx
type TMeasureNodeFn = (vertex: TVertex, utils: TMeasureNodeUtils) => { height: number; width: number };

type TMeasureNodeUtils = {
  layerType: 'html' | 'svg';
  getWrapperSize: () => { height: number; width: number };
  getWrapper: () => TOneOfTwo<{ htmlWrapper: HTMLDivElement | null }, { svgWrapper: SVGGElement | null }>;
};
```

#### Nodes layer

Any number of nodes layers can be configured for a `Digraph`.

In addition to the common layer configuration fields, the following fields are also available:

| Name | Type and description |
| :-- | :-- |
| setOnNode | `TNodePropsSetter` |
|  | Allows props to be defined or generated for the container of the node. This is a `<div>` for HTML layers and a `<g>` for SVG layers. **Note:** The resultant props are applied to the container element; they are not passed on to the `renderNode` factory.<br>&nbsp; |
| renderNode | `TRenderNodeFn` |
|  | **Required**<br>A factory function that is used to generate nodes from the `TLayoutVertex` data. `renderNode` is invoked for each `TLayoutVertex`. Unlike measurable nodes layers, the `TLayoutVertex` will always be available. This function will have access to the `TRenderUtils`, which means it can access the current zoom transform, but it is not redrawn when the zoom transform changes.<br>&nbsp; |

The types for `setOnNode` and `renderNode` are distinct from the corresponding fields on a measurable nodes layer in that the `layoutVertex` argument is **always available**.

The type for `setOnNode` is similar to that of `setOnContainer` in that the value can also be either an object of props, a factory function, or an array of either.

```tsx
type TNodePropsSetter = Record<string, unknown> | TNodesPropsFn | (TNodesPropsFn | Record<string, unknown>)[];

type TNodesPropsFn = (
  layoutVertex: TLayoutVertex | null,
  utils: TRendererUtils
) => Record<string, unknown> | null;
```

The type for the `renderNode` field.

```tsx
type TRenderNodeFn = (layoutVertex: TLayoutVertex, utils: TRendererUtils) => React.ReactNode;
```

#### Edges layer

Any number of edges layers can be configured for a `Digraph`. Edges layers are more restrictive (or less mature) than nodes layers, at present:

- The `layerType` of edges layers must be `"svg"`
- Edges layers do not afford a `renderEdge` equivalent to the `renderNode`.

Thus, edges are less configurable than nodes (for now). If you need additional functionality, please [file a ticket](https://github.com/jaegertracing/jaeger-ui/issues/new?labels=plexus&title=Plexus+edge+enhancements).

The builtin renderer for edges draws a path based on the `pathPoints` field of the `TLayoutEdge` being rendered.

In addition to the common layer configuration fields, the following fields are also available:

| Name | Type and description |
| :-- | :-- |
| edges | `true` |
|  | **Required**<br>Indicates the layer will render edges.<br>&nbsp; |
| layerType | `"svg"` |
|  | **Required**<br>Edges must be SVG layers.<br>&nbsp; |
| markerEndId | `string` |
|  | This field should refer to an element to use as the [`marker-end`](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/marker-end) for the edge `<path>`. A typical scenario matches the `markerEndId` to the `localId` of a `TDefEntry`. Each of the `localId` and `markerEndId` are passed through the `getLocalId()` util (TODO: reaname the util) to generate an ID unique within the document.<br>&nbsp; |
| markerStartId | `string` |
|  | The [`marker-start`](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/marker-start) equivalent of the `markerEndId` field.<br>&nbsp; |
| setOnEdge | `TEdgePropsSetter` _See below for details on this type._ |
|  | Allows props to be defined or generated for the `<path>`. Unlike nodes, edges are not wrapped in a container. So, the resultant props are applied directly to the `<path>`.<br>&nbsp; |
| defs | `TDefEntry[]` |
|  | For edges, this is generally used to define arrows (or other markers) in order to indicate directionality. See [`TDefEntry`](https://github.com/tiffon/jaeger-ui/wiki/_new#tdefentry) for additional details.<br><br>The default functionality of a `TDefEntry` is suitable to be the `markerEnd` of an edge. To define an arrow head marker on an edge layer, simple set the `markerEndId` of the layer to the `localId` of the `TDefEntry`:<br><br>`{ defs: [{ localId: 'arrow' }], markerEndId: 'arrow', ...otherProps }`<br>&nbsp; |

The type for `setOnEdge` is similar to that of `setOnContainer` in that the value can also be either an object of props, a factory function, or an array of either.

```tsx
type TEdgePropsSetter = Record<string, unknown> | TEdgesPropsFn | (TEdgesPropsFn | Record<string, unknown>)[];

type TEdgesPropsFn = (edge: TLayoutEdge, utils: TRendererUtils) => Record<string, unknown> | null;
```

#### HTML and SVG layers group

An HTML layers group can be used to group multiple HTML layers together. And, the SVG layers group does the same for SVG layers.

Using a group is mainly only going to be useful if `zoom` is enabled on the `Digraph` or if you want to set props on a container that is common to the layers within the group.

Regarding zoom, using a group will cause the current zoom transform to be applied once to the entire group instead of individually to each of the layers within the group.

**Note:** Layers configured within the `layers` field of a group of layers inherit the `layerType` from the group. The individual layers should not have a `layerType` defined.

```tsx
type THtmlLayersGroup = {
  key: string;
  layerType: 'html';
  setOnContainer?: TSetOnContainer;
  layers: (TMeasurableNodesLayer | TNodesLayer)[];
};

type TSvgLayersGroup = {
  key: string;
  layerType: 'svg';
  setOnContainer?: TSetOnContainer;
  defs?: TDefEntry[];
  layers: (TEdgesLayer | TMeasurableNodesLayer | TNodesLayer)[];
};
```

### Builtin props factories

TODO(joe): remove `scaledStrokeWidth` since it's no longer necessary

plexus ships with a few functions that are suitable for use with the `setOnContainer` field.

#### `classNameIsSmall`

This utility returns `{ className: 'is-small' }` if the graph is zoom out to a small scale. If added to a `setOnContainer` field or the `setOnGraph` prop of the `Digraph` it will add the CSS class to the container when the graph is zoomed out to a small scale.

This util can be used to hide text when it would be too small to read:

```css
.demo-graph.is-small .demo-node {
  color: transparent;
}
```

```tsx
<Digraph
  edges={edges}
  vertices={vertices}
  setOnGraph={[{ className: 'demo-graph' }, classNameIsSmall]}
  layoutManager={lm}
  measurableNodesKey="nodes"
  layers={[
    {
      key: 'nodes',
      layerType: 'html',
      measurable: true,
      // Alternatively, it can be used on the nodes layer
      // setOnContainer: classNameIsSmall,
      renderNode: (vertex: TVertex) => vertex.name,
      setOnNode: { className: 'demo-node' },
    },
    {
      key: 'edges',
      edges: true,
      layerType: 'svg',
      defs: [{ localId: 'arrow' }],
      markerEndId: 'arrow',
    },
  ]}
/>
```

Alternatively, it could be set on the `setOnContainer` field of the nodes layer.

#### `scaleProperty.opacity`

This utility will generate a style prop with the opacity reduced as the view zooms out.

In the following example, the opacity of the edges will be reduced as the view is zoomed out.

```tsx
<Digraph
  edges={edges}
  vertices={vertices}
  layoutManager={lm}
  measurableNodesKey="nodes"
  layers={[
    {
      key: 'nodes',
      layerType: 'html',
      measurable: true,
      renderNode: (vertex: TVertex) => vertex.name,
    },
    {
      key: 'edges',
      edges: true,
      layerType: 'svg',
      setOnContainer: scaleProperty.opacity,
      defs: [{ localId: 'arrow' }],
      markerEndId: 'arrow',
    },
  ]}
/>
```

#### `scaleProperty.strokeOpacity`

This is the same as `scaleProperty.opacity` (above) but it reduces the `stroke-opacity` when the view is zoomed out.

#### `scaleProperty`

`scaleProperty` is a factory function for creating utilities like `scaleProperty.opacity` that interpolate the value of a CSS property based on the scale of the graph's zoom transform. For instance, `scaleProperty.opacity` reduces the opacity as the scale of the graph reduces (i.e. as the user zooms out).

The typedef for the factory is:

```tsx
function scaleProperty(
    property: keyof React.CSSProperties,
    valueMin: number = 0.3,
    valueMax: number = 1,
    expAdjuster: number = 0.5
) => (graphState: TExposedGraphState) => React.CSSProperties;
```

With the default values, the property will approach `0.3` as the scale of the zoom transform approaches `0`. The `expAdjuster` is an exponent applied to the linear change. By default, the interpolation is based on the square root of the linear change.

If you need something more expressive, take a look at `packages/plexus/src/Digraph/utils.tsx`, which `scaleProperty` wraps.

## Recipes

TODO:

- Recipe for borders that don't diminish when the view is zoomed out
- Recipe for node outlines, for emphasis, that don't diminish when the view is zoomed out
- Recipe for coloring edges based on their direction
- Recipe for animating edges to indicate directionality
- Recipe for showing a 1x scale view of a node, on hover, only when the graph is less than N scale

### Arrow heads

An arrow head, to indicate directionality, can be added to an edges layer by adding a `TDefEntry` which uses the builtin renderer. The `localId` of the `TDefEntry` must match the `markerEndId` of the edges layer.

```tsx
const edgesLayer = {
  key: 'edges',
  edges: true,
  layerType: 'svg',
  defs: [{ localId: 'edge-arrow' }],
  markerEndId: 'edge-arrow',
};
```

### UX + edges

Edges can be quite thin, visually, which doesn't really lend itself to adding interactivity. To mitigate this, two layers of edges can be used. The lower layer is the visible layer which has a fairly thin stroke. A second edges layer above that layer an have a larger `stroke-width` but the stroke color is set to `transparent`. On this larger stroke we add our interactivity.

```tsx
const edgeLayersGroup = {
  key: 'edges-layers',
  layerType: 'svg',
  defs: [{ localId: 'arrow-head' }],
  layers: [
    {
      key: 'edges',
      markerEndId: 'arrow-head',
      edges: true,
    },
    {
      key: 'edges-pointer-area',
      edges: true,
      setOnContainer: { style: { opacity: 0, strokeWidth: 4 } },
      setOnEdge: layoutEdge => ({
        onMouseOver: () => console.log('mouse over', layoutEdge),
        onMouseOut: () => console.log('mouse out', layoutEdge),
      }),
    },
  ],
};
```
