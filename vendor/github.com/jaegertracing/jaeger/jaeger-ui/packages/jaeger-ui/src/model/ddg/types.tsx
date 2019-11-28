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

import { TVertex } from '@jaegertracing/plexus/lib/types';

import PathElem from './PathElem';

export { default as PathElem } from './PathElem';

export enum EViewModifier {
  None,
  Hovered,
  Selected,
  Emphasized = 1 << 2, // eslint-disable-line no-bitwise
  PathHovered = 1 << 3, // eslint-disable-line no-bitwise
}

export enum EDdgDensity {
  ExternalVsInternal = 'ext-vs-int',
  MostConcise = 'mc',
  OnePerLevel = 'per-level',
  PreventPathEntanglement = 'ppe',
  UpstreamVsDownstream = 'up-vs-down',
}

export enum ECheckedStatus {
  Empty = 'Empty',
  Full = 'Full',
  Partial = 'Partial',
}

export enum EDirection {
  Upstream = -1,
  Downstream = 1,
}

export type TDdgPayloadEntry = {
  operation: string;
  service: string;
};

export type TDdgPayloadPath = {
  path: TDdgPayloadEntry[];
  // TODO: Everett Tech Debt: Fix KeyValuePair types
  attributes: {
    key: 'exemplar_trace_id'; // eslint-disable-line camelcase
    value: string;
  }[];
};

export type TDdgPayload = {
  dependencies: TDdgPayloadPath[];
};

export type TDdgService = {
  name: string;
  operations: Map<string, TDdgOperation>;
};

export type TDdgOperation = {
  name: string;
  pathElems: PathElem[];
  service: TDdgService;
};

export type TDdgServiceMap = Map<string, TDdgService>;

export type TDdgPath = {
  focalIdx: number;
  members: PathElem[];
  traceIDs: string[];
};

export type TDdgDistanceToPathElems = Map<number, PathElem[]>;

export type TDdgModel = {
  distanceToPathElems: TDdgDistanceToPathElems;
  hash: string;
  paths: TDdgPath[];
  services: TDdgServiceMap;
  visIdxToPathElem: PathElem[];
};

export type TDdgVertex = TVertex<{
  isFocalNode: boolean;
  key: string;
  operation: string | null;
  service: string;
}>;

export type TDdgSparseUrlState = {
  density: EDdgDensity;
  end?: number;
  hash?: string;
  operation?: string;
  service?: string;
  showOp: boolean;
  start?: number;
  visEncoding?: string;
};

export type TDdgModelParams = {
  service: string;
  operation?: string;
  start: number;
  end: number;
};

export type TDdgActionMeta = {
  query: TDdgModelParams;
};

export type TDdgAddViewModifierPayload = TDdgModelParams & {
  // Number instead of EViewModifier so that multiple views can be changed at once.
  viewModifier: number;
  visibilityIndices: number[];
};

export type TDdgClearViewModifiersFromIndicesPayload = TDdgAddViewModifierPayload & { viewModifier?: void };

export type TDdgRemoveViewModifierFromIndicesPayload = TDdgAddViewModifierPayload;

export type TDdgRemoveViewModifierPayload = TDdgAddViewModifierPayload & { visibilityIndices?: void };

export type TDdgViewModifierRemovalPayload =
  | TDdgClearViewModifiersFromIndicesPayload
  | TDdgRemoveViewModifierFromIndicesPayload
  | TDdgRemoveViewModifierPayload;

export type THop = { distance: number; fullness: ECheckedStatus };
