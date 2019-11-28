// Copyright (c) 2018 Uber Technologies, Inc.
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

import { Span } from '../../../types/trace';
import { TNil } from '../../../types';

export type NodeID = string;

export type DiffCounts = {
  a: number;
  b: number;
};

export type DenseSpan = {
  span: Span;
  id: string;
  service: string;
  operation: string;
  tags: Record<string, any>;
  parentID: string | TNil;
  skipToChild: boolean;
  children: Set<string>;
};
