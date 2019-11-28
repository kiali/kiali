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
// eslint-disable-next-line import/no-extraneous-dependencies
import { render } from 'react-dom';

import largeDag, { getNodeLabel as getLargeNodeLabel, TLargeNode } from './data-large';
import { edges as dagEdges, vertices as dagVertices } from './data-dag';
import { colored as colorData, getColorNodeLabel, setOnColorEdge, setOnColorNode } from './data-small';
import { Digraph, DirectedGraph, LayoutManager } from '../../src';
import cacheAs from '../../src/cacheAs';
import { TLayer, TRendererUtils, TMeasureNodeUtils } from '../../src/Digraph/types';
import { TVertex, TLayoutEdge, TLayoutVertex } from '../../src/types';
import TNonEmptyArray from '../../src/types/TNonEmptyArray';

import './index.css';

type TState = {
  hoveredEdge: TLayoutEdge<any> | null;
};

const { classNameIsSmall } = DirectedGraph.propsFactories;
const { classNameIsSmall: layeredClassNameIsSmall, scaleStrokeOpacity } = Digraph.propsFactories;

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

const addAnAttr = () => ({ 'data-rando': Math.random() });
const setOnNode = (vertex: TVertex) => ({
  className: 'DemoGraph--node',
  // eslint-disable-next-line no-console
  onClick: () => console.log(vertex.key),
});

function renderComparisons(
  a: { nodesKey: string; layers: TNonEmptyArray<TLayer<any, any>> },
  b: { nodesKey: string; layers: TNonEmptyArray<TLayer<any, any>> },
  hoveredEdge: TLayoutEdge<any> | null = null
) {
  return (
    <>
      <div className="demo-row">
        <div>
          <div className="DemoGraph is-small">
            <Digraph
              zoom
              minimap
              className="DemoGraph--dag"
              layoutManager={new LayoutManager({ useDotEdges: true })}
              minimapClassName="Demo--miniMap"
              setOnGraph={layeredClassNameIsSmall}
              measurableNodesKey={a.nodesKey}
              layers={a.layers}
              {...largeDag}
            />
          </div>
        </div>
        <div>
          <div className="DemoGraph is-small">
            <Digraph
              zoom
              minimap
              className="DemoGraph--dag"
              layoutManager={new LayoutManager({ useDotEdges: true })}
              minimapClassName="Demo--miniMap"
              setOnGraph={layeredClassNameIsSmall}
              measurableNodesKey={b.nodesKey}
              layers={b.layers}
              {...largeDag}
            />
          </div>
        </div>
      </div>
      <div className="demo-row">
        <div>
          <p>
            hovered edge:{' '}
            {hoveredEdge && (
              <span>
                <strong>{hoveredEdge.edge.from}</strong> → <strong>{hoveredEdge.edge.to}</strong>
              </span>
            )}
          </p>
          <div className="DemoGraph">
            <Digraph
              zoom
              minimap
              className="DemoGraph--dag"
              layoutManager={new LayoutManager({ useDotEdges: true })}
              minimapClassName="Demo--miniMap"
              setOnGraph={layeredClassNameIsSmall}
              measurableNodesKey={a.nodesKey}
              layers={a.layers}
              {...largeDag}
            />
          </div>
        </div>
        <div>
          <p>&nbsp;</p>
          <div className="DemoGraph">
            <Digraph
              zoom
              minimap
              className="DemoGraph--dag"
              layoutManager={new LayoutManager({ useDotEdges: true })}
              minimapClassName="Demo--miniMap"
              setOnGraph={layeredClassNameIsSmall}
              measurableNodesKey={b.nodesKey}
              layers={b.layers}
              {...largeDag}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function renderVowelEmphasisHtml(lv: TLayoutVertex<any>) {
  return VOWELS.has(lv.vertex.key[0]) ? <div className="DemoGraph--node--emphasized" /> : null;
}

function renderVowelEmphasisBorderSvg(lv: TLayoutVertex<any>) {
  if (!VOWELS.has(lv.vertex.key[0])) {
    return null;
  }
  return (
    <g>
      <rect
        className="DemoGraph--node--vectorEmphasized-border"
        vectorEffect="non-scaling-stroke"
        width={lv.width}
        height={lv.height}
      />
    </g>
  );
}

function renderVowelEmphasisSvg(lv: TLayoutVertex<any>) {
  if (!VOWELS.has(lv.vertex.key[0])) {
    return null;
  }
  return (
    <g>
      <rect
        className="DemoGraph--node--vectorEmphasized"
        vectorEffect="non-scaling-stroke"
        width={lv.width}
        height={lv.height}
      />
    </g>
  );
}

function renderNodeVectorBorder(lv: TLayoutVertex<any>) {
  return (
    <rect
      className="DemoGraph--node--vectorBorder"
      vectorEffect="non-scaling-stroke"
      width={lv.width}
      height={lv.height}
    />
  );
}

class Demo extends React.PureComponent<{}, TState> {
  state: TState = {
    hoveredEdge: null,
  };

  hovering: TLayoutEdge<any> | null = null;

  private updateHoveredState = (props: {}, state: TState) => {
    const { hoveredEdge } = state;
    if (hoveredEdge !== this.hovering) {
      return { hoveredEdge: this.hovering };
    }
    return null;
  };

  private setUxOnEdge = (layoutEdge: TLayoutEdge<any>) => ({
    onMouseOver: () => this.onEdgeEnter(layoutEdge),
    onMouseOut: () => this.onEdgeExit(layoutEdge),
  });

  private onEdgeEnter = (le: TLayoutEdge<any>) => {
    this.hovering = le;
    this.setState(this.updateHoveredState);
  };

  private onEdgeExit = (le: TLayoutEdge<any>) => {
    if (this.hovering === le) {
      this.hovering = null;
    }
    this.setState(this.updateHoveredState);
  };

  render() {
    const { hoveredEdge } = this.state;
    return (
      <div>
        <h1>Digraph</h1>
        {renderComparisons(
          {
            nodesKey: 'main-nodes',
            layers: [
              {
                key: 'nodes-layers',
                layerType: 'html',
                layers: [
                  {
                    key: 'emph-nodes',
                    renderNode: renderVowelEmphasisHtml,
                  },
                  {
                    setOnNode,
                    key: 'main-nodes',
                    measurable: true,
                    renderNode: getLargeNodeLabel,
                  },
                ],
              },
              {
                key: 'edges-layers',
                layerType: 'svg',
                defs: [{ localId: 'arrow-head' }],
                layers: [
                  {
                    key: 'edges',
                    markerEndId: 'arrow-head',
                    edges: true,
                    setOnContainer: scaleStrokeOpacity,
                  },
                  {
                    key: 'edges-pointer-area',
                    edges: true,
                    setOnContainer: cacheAs('html-effects/edges-pointer-area/set-on-container', {
                      style: { cursor: 'default', opacity: 0, strokeWidth: 4 },
                    }),
                    setOnEdge: this.setUxOnEdge,
                  },
                ],
              },
            ],
          },
          {
            nodesKey: 'nodes',
            layers: [
              {
                key: 'emph-nodes-border',
                layerType: 'svg',
                renderNode: renderVowelEmphasisBorderSvg,
              },
              {
                key: 'emph-nodes-html',
                layerType: 'html',
                renderNode: renderVowelEmphasisHtml,
              },
              {
                key: 'node-effects-svg-layer',
                layerType: 'svg',
                layers: [
                  {
                    key: 'emph-nodes',
                    renderNode: renderVowelEmphasisSvg,
                  },
                  {
                    key: 'border-nodes',
                    renderNode: renderNodeVectorBorder,
                  },
                ],
              },
              {
                setOnNode: cacheAs('svg-effects/nodes/set-on-node', [
                  setOnNode,
                  { className: 'is-vector-bordered' },
                ]),
                key: 'nodes',
                layerType: 'html',
                measurable: true,
                renderNode: getLargeNodeLabel,
              },
              {
                key: 'edges-visible-path',
                defs: [{ localId: 'arrowHead' }],
                edges: true,
                layerType: 'svg',
                markerEndId: 'arrowHead',
                setOnContainer: cacheAs('svg-effects/edges-visible-path/set-on-node', [
                  { className: 'DdgGraph--edges' },
                  scaleStrokeOpacity,
                ]),
              },
              {
                key: 'edges-pointer-area',
                edges: true,
                layerType: 'svg',
                setOnContainer: cacheAs('svg-effects/edges-pointer-area/set-on-container', {
                  style: { cursor: 'default', opacity: 0, strokeWidth: 4 },
                }),
                setOnEdge: this.setUxOnEdge,
              },
            ],
          },
          hoveredEdge
        )}
        <h1>Digraph with measurable SVG nodes</h1>
        <div>
          <div className="DemoGraph">
            <Digraph<TLargeNode>
              zoom
              minimap
              className="DemoGraph--dag"
              layoutManager={new LayoutManager({ useDotEdges: true })}
              minimapClassName="Demo--miniMap"
              setOnGraph={layeredClassNameIsSmall}
              measurableNodesKey="nodes"
              layers={[
                {
                  key: 'edges',
                  defs: [{ localId: 'arrowHead' }],
                  edges: true,
                  layerType: 'svg',
                  markerEndId: 'arrowHead',
                  setOnContainer: cacheAs('svg-nodes/edges/set-on-container', [
                    { className: 'DdgGraph--edges' },
                    scaleStrokeOpacity,
                  ]),
                },
                {
                  key: 'nodes',
                  layerType: 'svg',
                  measurable: true,
                  measureNode: cacheAs('svg-nodes/nodes/measure', (_: TVertex, utils: TMeasureNodeUtils) => {
                    const { height, width } = utils.getWrapperSize();
                    return { height: height + 40, width: width + 40 };
                  }),
                  renderNode: cacheAs(
                    'svg-nodes/nodes/render',
                    (
                      vertex: TVertex<TLargeNode>,
                      utils: TRendererUtils,
                      lv: TLayoutVertex<TLargeNode> | null
                    ) => (
                      <>
                        {lv && (
                          <rect
                            width={lv.width}
                            height={lv.height}
                            fill="#ddd"
                            stroke="#444"
                            strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                        <text x="20" y="20" dy="1em">
                          {vertex.key}
                        </text>
                      </>
                    )
                  ),
                },
              ]}
              edges={largeDag.edges}
              vertices={largeDag.vertices}
            />
          </div>
        </div>
        <h1>Digraph with neato edges and rankdir = TB</h1>
        <div>
          <div className="DemoGraph">
            <Digraph<TLargeNode>
              zoom
              minimap
              className="DemoGraph--dag"
              layoutManager={
                new LayoutManager({ useDotEdges: false, nodesep: 7, ranksep: 10, rankdir: 'TB' })
              }
              minimapClassName="Demo--miniMap"
              setOnGraph={layeredClassNameIsSmall}
              measurableNodesKey="nodes"
              layers={[
                {
                  key: 'edges',
                  defs: [{ localId: 'arrowHead' }],
                  edges: true,
                  layerType: 'svg',
                  markerEndId: 'arrowHead',
                  setOnContainer: cacheAs('svg-nodes/edges/set-on-container', [
                    { className: 'DdgGraph--edges' },
                    scaleStrokeOpacity,
                  ]),
                },
                {
                  key: 'nodes',
                  layerType: 'svg',
                  measurable: true,
                  measureNode: cacheAs('svg-nodes/nodes/measure', (_: TVertex, utils: TMeasureNodeUtils) => {
                    const { height, width } = utils.getWrapperSize();
                    return { height: height + 40, width: width + 40 };
                  }),
                  renderNode: cacheAs(
                    'svg-nodes-tb/nodes/render',
                    (
                      vertex: TVertex<TLargeNode>,
                      utils: TRendererUtils,
                      lv: TLayoutVertex<TLargeNode> | null
                    ) => (
                      <>
                        {lv && (
                          <rect
                            width={lv.width}
                            height={lv.height}
                            fill="#ddd"
                            stroke="#444"
                            strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                        <text x="20" y="20" dy="1em">
                          {vertex.service}
                        </text>
                      </>
                    )
                  ),
                },
              ]}
              edges={largeDag.edges.map(edge => ({
                from: edge.from.repeat(8),
                to: edge.to.repeat(8),
              }))}
              vertices={largeDag.vertices.map(vtx => ({
                ...vtx,
                key: vtx.key.repeat(8),
              }))}
            />
          </div>
        </div>
        <h1>Directed graph with cycles - dot edges</h1>
        <div>
          <div className="DemoGraph">
            <DirectedGraph
              zoom
              minimap
              arrowScaleDampener={0.8}
              className="DemoGraph--dag"
              getNodeLabel={getLargeNodeLabel}
              layoutManager={new LayoutManager({ useDotEdges: true })}
              minimapClassName="Demo--miniMap"
              setOnNode={setOnNode}
              setOnRoot={classNameIsSmall}
              {...largeDag}
            />
          </div>
        </div>
        <h1>Directed graph with cycles - neato edges</h1>
        <div>
          <div className="DemoGraph">
            <DirectedGraph
              zoom
              minimap
              arrowScaleDampener={0.8}
              className="DemoGraph--dag"
              getNodeLabel={getLargeNodeLabel}
              layoutManager={new LayoutManager()}
              minimapClassName="Demo--miniMap"
              setOnNode={setOnNode}
              setOnRoot={classNameIsSmall}
              {...largeDag}
            />
          </div>
        </div>
        <h1>Directed graph with cycles - dot edges - polylines</h1>
        <div>
          <div className="DemoGraph">
            <DirectedGraph
              zoom
              minimap
              arrowScaleDampener={0.8}
              className="DemoGraph--dag"
              getNodeLabel={getLargeNodeLabel}
              layoutManager={
                new LayoutManager({
                  useDotEdges: true,
                  splines: 'polyline',
                  ranksep: 8,
                })
              }
              minimapClassName="Demo--miniMap"
              setOnNode={setOnNode}
              setOnRoot={classNameIsSmall}
              {...largeDag}
            />
          </div>
        </div>
        <h1>Small graph with data driven rendering</h1>
        <DirectedGraph
          className="DemoGraph--dag"
          getNodeLabel={colorData ? getColorNodeLabel : null}
          layoutManager={new LayoutManager()}
          setOnEdgePath={colorData ? setOnColorEdge : null}
          setOnEdgesContainer={addAnAttr}
          setOnNode={colorData ? setOnColorNode : null}
          setOnNodesContainer={addAnAttr}
          {...colorData}
        />
        <h1>Medium DAG</h1>
        <div className="DemoGraph">
          <DirectedGraph
            className="DemoGraph--dag"
            edges={dagEdges}
            layoutManager={new LayoutManager({ useDotEdges: true })}
            minimapClassName="Demo--miniMap"
            setOnNode={setOnNode}
            vertices={dagVertices}
            minimap
            zoom
          />
        </div>
      </div>
    );
  }
}

render(<Demo />, document.querySelector('#root'));
