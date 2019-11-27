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
import cx from 'classnames';
import { TLayoutVertex } from '@jaegertracing/plexus/lib/types';

import { TDdgVertex, EViewModifier } from '../../../model/ddg/types';

import './getNodeRenderers.css';

export default function getNodeRenderers(findMatches: Set<TDdgVertex>, viewModifiers: Map<string, number>) {
  function vectorBorder(lv: TLayoutVertex<TDdgVertex>) {
    // eslint-disable-next-line no-bitwise
    const isHovered = (viewModifiers.get(lv.vertex.key) || 0) & EViewModifier.Hovered;
    // eslint-disable-next-line no-bitwise
    const isPathHovered = (viewModifiers.get(lv.vertex.key) || 0) & EViewModifier.PathHovered;
    const className = cx('DdgNode--VectorBorder', {
      'is-findMatch': findMatches.has(lv.vertex),
      'is-hovered': isHovered,
      'is-pathHovered': isPathHovered,
      'is-focalNode': lv.vertex.isFocalNode,
    });
    return (
      <circle
        className={className}
        vectorEffect="non-scaling-stroke"
        r={lv.width / 2 - 1}
        cx={lv.width / 2}
        cy={lv.width / 2}
      />
    );
  }

  function htmlEmphasis(lv: TLayoutVertex<any>) {
    const matchClasses = cx({
      'is-findMatch': findMatches.has(lv.vertex),
      'is-focalNode': lv.vertex.isFocalNode,
    });
    if (!matchClasses) {
      return null;
    }
    return <div className={`DdgNode--HtmlEmphasis ${matchClasses}`} />;
  }

  if (!findMatches.size) {
    return {
      vectorBorder,
      htmlEmphasis,
      vectorFindColorBand: null,
    };
  }

  function vectorFindColorBand(lv: TLayoutVertex<any>) {
    if (!findMatches.has(lv.vertex)) {
      return null;
    }
    return (
      <circle
        className="DdgNode--VectorFindEmphasis--colorBand"
        vectorEffect="non-scaling-stroke"
        r={lv.width / 2 - 1}
        cx={lv.width / 2}
        cy={lv.width / 2}
      />
    );
  }

  return {
    htmlEmphasis,
    vectorBorder,
    vectorFindColorBand,
  };
}
