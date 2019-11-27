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

// Note: These type defs cannot be in the typings/index.d.ts file (due to
// TypeScript automagic?).

// Type def for the viz.js module, which doesn't ship with usable TypeScript
// types.
declare module "viz.js/viz.js" {
  export default function viz(dot: string, options?: {}): string;
}
