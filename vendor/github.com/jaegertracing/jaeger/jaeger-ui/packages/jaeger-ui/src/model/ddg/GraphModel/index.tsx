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

import memoize from 'lru-memoize';

import { TEdge } from '@jaegertracing/plexus/lib/types';

import getDerivedViewModifiers from './getDerivedViewModifiers';
import getEdgeId from './getEdgeId';
import getPathElemHasher from './getPathElemHasher';
import { decode, encode } from '../visibility-codec';

import { PathElem, EDdgDensity, TDdgDistanceToPathElems, TDdgModel, TDdgVertex } from '../types';

export { default as getEdgeId } from './getEdgeId';

export default class GraphModel {
  readonly getDerivedViewModifiers = memoize(3)(getDerivedViewModifiers.bind(this));
  private readonly getPathElemHasher = getPathElemHasher;
  readonly density: EDdgDensity;
  readonly distanceToPathElems: TDdgDistanceToPathElems;
  readonly pathElemToEdge: Map<PathElem, TEdge>;
  readonly pathElemToVertex: Map<PathElem, TDdgVertex>;
  readonly showOp: boolean;
  readonly vertexToPathElems: Map<TDdgVertex, Set<PathElem>>;
  readonly vertices: Map<string, TDdgVertex>;
  readonly visIdxToPathElem: PathElem[];

  constructor({ ddgModel, density, showOp }: { ddgModel: TDdgModel; density: EDdgDensity; showOp: boolean }) {
    this.density = density;
    this.distanceToPathElems = new Map(ddgModel.distanceToPathElems);
    this.pathElemToEdge = new Map();
    this.pathElemToVertex = new Map();
    this.showOp = showOp;
    this.vertexToPathElems = new Map();
    this.vertices = new Map();
    this.visIdxToPathElem = ddgModel.visIdxToPathElem.slice();

    const hasher = this.getPathElemHasher();
    const edgesById = new Map<string, TEdge>();

    ddgModel.visIdxToPathElem.forEach(pathElem => {
      // If there is a compatible vertex for this pathElem, use it, else, make a new vertex
      const key = hasher(pathElem);
      let vertex: TDdgVertex | undefined = this.vertices.get(key);
      if (!vertex) {
        const isFocalNode = !pathElem.distance;
        vertex = {
          key,
          isFocalNode,
          service: pathElem.operation.service.name,
          operation: this.showOp || isFocalNode ? pathElem.operation.name : null,
        };
        this.vertices.set(key, vertex);
        this.vertexToPathElems.set(vertex, new Set([pathElem]));
      } else {
        const pathElemsForVertex = this.vertexToPathElems.get(vertex);
        /* istanbul ignore next */
        if (!pathElemsForVertex) {
          throw new Error(`Vertex exists without pathElems, vertex: ${vertex}`);
        }
        // Link vertex back to this pathElem
        pathElemsForVertex.add(pathElem);
      }
      // Link pathElem to its vertex
      this.pathElemToVertex.set(pathElem, vertex);

      // If the newly-visible PathElem is not the focalNode, it needs to be connected to the rest of the graph
      const connectedElem = pathElem.focalSideNeighbor;
      if (connectedElem) {
        const connectedVertex = this.pathElemToVertex.get(connectedElem);
        // If the connectedElem does not have a vertex, then the current pathElem cannot be connected to the
        // focalNode
        if (!connectedVertex) {
          throw new Error(`Non-focal pathElem cannot be connected to graph. PathElem: ${pathElem}`);
        }

        // Create edge connecting current vertex to connectedVertex
        const from = pathElem.distance > 0 ? connectedVertex.key : vertex.key;
        const to = pathElem.distance > 0 ? vertex.key : connectedVertex.key;
        const edgeId = getEdgeId(from, to);
        const existingEdge = edgesById.get(edgeId);
        if (!existingEdge) {
          const edge = { from, to };
          edgesById.set(edgeId, edge);
          this.pathElemToEdge.set(pathElem, edge);
        } else {
          this.pathElemToEdge.set(pathElem, existingEdge);
        }
      }
    });

    Object.freeze(this.distanceToPathElems);
    Object.freeze(this.pathElemToEdge);
    Object.freeze(this.pathElemToVertex);
    Object.freeze(this.vertexToPathElems);
    Object.freeze(this.vertices);
    Object.freeze(this.visIdxToPathElem);
  }

  // Only public for bound fn getDerivedViewModifiers
  public getDefaultVisiblePathElems() {
    return ([] as PathElem[]).concat(
      this.distanceToPathElems.get(-2) || [],
      this.distanceToPathElems.get(-1) || [],
      this.distanceToPathElems.get(0) || [],
      this.distanceToPathElems.get(1) || [],
      this.distanceToPathElems.get(2) || []
    );
  }

  private getVisiblePathElems(visEncoding?: string) {
    if (visEncoding == null) return this.getDefaultVisiblePathElems();
    return decode(visEncoding)
      .map(visIdx => this.visIdxToPathElem[visIdx])
      .filter(Boolean);
  }

  public getVisible: (visEncoding?: string) => { edges: TEdge[]; vertices: TDdgVertex[] } = memoize(10)(
    (visEncoding?: string): { edges: TEdge[]; vertices: TDdgVertex[] } => {
      const edges: Set<TEdge> = new Set();
      const vertices: Set<TDdgVertex> = new Set();
      const pathElems = this.getVisiblePathElems(visEncoding);
      pathElems.forEach(pathElem => {
        const edge = this.pathElemToEdge.get(pathElem);
        if (edge) edges.add(edge);
        const vertex = this.pathElemToVertex.get(pathElem);
        if (vertex) vertices.add(vertex);
      });

      return {
        edges: Array.from(edges),
        vertices: Array.from(vertices),
      };
    }
  );

  private static getUiFindMatches(vertices: TDdgVertex[], uiFind?: string) {
    const vertexSet: Set<TDdgVertex> = new Set();
    if (!uiFind) return vertexSet;

    const uiFindArr = uiFind
      .trim()
      .toLowerCase()
      .split(' ');
    for (let i = 0; i < vertices.length; i++) {
      const { service, operation } = vertices[i];
      const svc = service.toLowerCase();
      const op = operation && operation.toLowerCase();
      for (let j = 0; j < uiFindArr.length; j++) {
        if (svc.includes(uiFindArr[j]) || (op && op.includes(uiFindArr[j]))) {
          vertexSet.add(vertices[i]);
          break;
        }
      }
    }

    return vertexSet;
  }

  public getHiddenUiFindMatches: (uiFind?: string, visEncoding?: string) => Set<TDdgVertex> = memoize(10)(
    (uiFind?: string, visEncoding?: string): Set<TDdgVertex> => {
      const visible = new Set(this.getVisible(visEncoding).vertices);
      const hidden: TDdgVertex[] = Array.from(this.vertices.values()).filter(vertex => !visible.has(vertex));
      return GraphModel.getUiFindMatches(hidden, uiFind);
    }
  );

  public getVisibleUiFindMatches: (uiFind?: string, visEncoding?: string) => Set<TDdgVertex> = memoize(10)(
    (uiFind?: string, visEncoding?: string): Set<TDdgVertex> => {
      const { vertices } = this.getVisible(visEncoding);
      return GraphModel.getUiFindMatches(vertices, uiFind);
    }
  );

  public getVisWithVertices = (vertices: TDdgVertex[], visEncoding?: string) => {
    const indices: Set<number> = new Set(this.getVisiblePathElems(visEncoding).map(pe => pe.visibilityIdx));

    vertices.forEach(vertex => {
      const elems = this.vertexToPathElems.get(vertex);
      if (!elems) throw new Error(`${vertex} does not exist in graph`);

      elems.forEach(elem => {
        elem.focalPath.forEach(({ visibilityIdx }) => indices.add(visibilityIdx));
      });
    });

    return encode(Array.from(indices));
  };

  public getVertexVisiblePathElems = (
    vertexKey: string,
    visEncoding: string | undefined
  ): PathElem[] | undefined => {
    const vertex = this.vertices.get(vertexKey);
    if (vertex) {
      const pathElems = this.vertexToPathElems.get(vertex);
      if (pathElems && pathElems.size) {
        const visIndices = visEncoding ? new Set(decode(visEncoding)) : undefined;
        return Array.from(pathElems).filter(elem => {
          return visIndices ? visIndices.has(elem.visibilityIdx) : Math.abs(elem.distance) < 3;
        });
      }
    }
    return undefined;
  };
}

export const makeGraph = memoize(10)(
  (ddgModel: TDdgModel, showOp: boolean, density: EDdgDensity) =>
    new GraphModel({ ddgModel, density, showOp })
);
