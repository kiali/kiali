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

import React, { PureComponent } from 'react';
import memoize from 'memoize-one';
import { Digraph, LayoutManager } from '@jaegertracing/plexus';
import { TSetProps, TFromGraphStateFn, TDefEntry } from '@jaegertracing/plexus/lib/Digraph/types';
import { TEdge } from '@jaegertracing/plexus/lib/types';
import TNonEmptyArray from '@jaegertracing/plexus/lib/types/TNonEmptyArray';

import DdgNodeContent from './DdgNodeContent';
import getNodeRenderers from './getNodeRenderers';
import getSetOnEdge from './getSetOnEdge';
import { PathElem, TDdgVertex, EDdgDensity, EViewModifier } from '../../../model/ddg/types';

import './index.css';

type TProps = {
  baseUrl: string;
  density: EDdgDensity;
  edges: TEdge[];
  edgesViewModifiers: Map<string, number>;
  extraUrlArgs?: { [key: string]: unknown };
  getVisiblePathElems: (vertexKey: string) => PathElem[] | undefined;
  setViewModifier: (vertexKey: string, viewModifier: EViewModifier, enable: boolean) => void;
  showOp: boolean;
  uiFindMatches: Set<TDdgVertex> | undefined;
  vertices: TDdgVertex[];
  verticesViewModifiers: Map<string, number>;
};

// exported for tests
// The dichotomy between w/ & w/o VMs assumes that any edge VM neccesitates unmodified edges are de-emphasized
export const setOnEdgesContainer: Record<string, TSetProps<TFromGraphStateFn<unknown, unknown>>> = {
  withViewModifiers: [{ className: 'Ddg--Edges is-withViewModifiers' }],
  withoutViewModifiers: [Digraph.propsFactories.scaleStrokeOpacityStrongest, { className: 'Ddg--Edges' }],
};

// exported for tests
// The dichotomy between w/ & w/o VMs assumes that any vertex VM makes unmodified vertices de-emphasized
export const setOnVectorBorderContainerWithViewModifiers: TSetProps<
  TFromGraphStateFn<TDdgVertex, unknown>
> = {
  className: 'DdgVectorBorders is-withViewModifiers',
};

const edgesDefs: TNonEmptyArray<TDefEntry<TDdgVertex, unknown>> = [
  { localId: 'arrow' },
  { localId: 'arrow-hovered', setOnEntry: { className: 'Ddg--Arrow is-pathHovered' } },
];

export default class Graph extends PureComponent<TProps> {
  private getNodeRenderers = memoize(getNodeRenderers);
  private getNodeContentRenderer = memoize(DdgNodeContent.getNodeRenderer);
  private getSetOnEdge = memoize(getSetOnEdge);

  private layoutManager: LayoutManager = new LayoutManager({
    nodesep: 0.55,
    ranksep: 1.5,
    rankdir: 'TB',
    shape: 'circle',
    splines: 'polyline',
    useDotEdges: true,
  });

  private emptyFindSet: Set<TDdgVertex> = new Set();

  componentWillUnmount() {
    this.layoutManager.stopAndRelease();
  }

  render() {
    const {
      density,
      edges,
      edgesViewModifiers,
      getVisiblePathElems,
      setViewModifier,
      showOp,
      uiFindMatches,
      vertices,
      verticesViewModifiers,
      baseUrl,
      extraUrlArgs,
    } = this.props;
    const nodeRenderers = this.getNodeRenderers(uiFindMatches || this.emptyFindSet, verticesViewModifiers);

    return (
      <Digraph<TDdgVertex>
        minimap
        zoom
        minimapClassName="u-miniMap"
        layoutManager={this.layoutManager}
        edges={edges}
        vertices={vertices}
        measurableNodesKey="nodes/content"
        layers={[
          {
            key: 'nodes/find-emphasis/html',
            layerType: 'html',
            renderNode: nodeRenderers.htmlEmphasis,
          },
          {
            key: 'nodes/find-emphasis/vector-color-band',
            layerType: 'svg',
            renderNode: nodeRenderers.vectorFindColorBand,
          },
          {
            key: 'nodes/vector-border',
            layerType: 'svg',
            renderNode: nodeRenderers.vectorBorder,
            setOnContainer: verticesViewModifiers.size
              ? setOnVectorBorderContainerWithViewModifiers
              : Digraph.propsFactories.scaleStrokeOpacityStrongest,
          },
          {
            key: 'edges',
            layerType: 'svg',
            edges: true,
            defs: edgesDefs,
            markerEndId: 'arrow',
            setOnContainer: edgesViewModifiers.size
              ? setOnEdgesContainer.withViewModifiers
              : setOnEdgesContainer.withoutViewModifiers,
            setOnEdge: this.getSetOnEdge(edgesViewModifiers),
          },
          {
            key: 'nodes/content',
            layerType: 'html',
            measurable: true,
            measureNode: DdgNodeContent.measureNode,
            renderNode: this.getNodeContentRenderer(
              getVisiblePathElems,
              setViewModifier,
              density,
              showOp,
              baseUrl,
              extraUrlArgs
            ),
          },
        ]}
      />
    );
  }
}
