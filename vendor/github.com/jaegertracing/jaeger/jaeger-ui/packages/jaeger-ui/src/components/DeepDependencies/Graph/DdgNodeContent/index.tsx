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

import calcPositioning from './calc-positioning';
import {
  MAX_LENGTH,
  MAX_LINKED_TRACES,
  MIN_LENGTH,
  OP_PADDING_TOP,
  PARAM_NAME_LENGTH,
  RADIUS,
  WORD_RX,
} from './constants';
import { setFocusIcon } from './node-icons';
import { getUrl } from '../../url';
import BreakableText from '../../../common/BreakableText';
import NewWindowIcon from '../../../common/NewWindowIcon';
import { getUrl as getSearchUrl } from '../../../SearchTracePage/url';
import { EDdgDensity, EViewModifier, TDdgVertex, PathElem } from '../../../../model/ddg/types';

import './index.css';

type TProps = {
  focalNodeUrl: string | null;
  getVisiblePathElems: (vertexKey: string) => PathElem[] | undefined;
  isFocalNode: boolean;
  isPositioned: boolean;
  operation: string | null;
  service: string;
  setViewModifier: (vertexKey: string, viewModifier: EViewModifier, isEnabled: boolean) => void;
  vertexKey: string;
};

export default class DdgNodeContent extends React.PureComponent<TProps> {
  static measureNode() {
    const diameter = 2 * (RADIUS + 1);

    return {
      height: diameter,
      width: diameter,
    };
  }

  static getNodeRenderer(
    getVisiblePathElems: (vertexKey: string) => PathElem[] | undefined,
    setViewModifier: (vertexKey: string, viewModifier: EViewModifier, enable: boolean) => void,
    density: EDdgDensity,
    showOp: boolean,
    baseUrl: string,
    extraUrlArgs: { [key: string]: unknown } | undefined
  ) {
    return function renderNode(vertex: TDdgVertex, _: unknown, lv: TLayoutVertex<any> | null) {
      const { isFocalNode, key, operation, service } = vertex;
      return (
        <DdgNodeContent
          focalNodeUrl={
            isFocalNode ? null : getUrl({ density, operation, service, showOp, ...extraUrlArgs }, baseUrl)
          }
          getVisiblePathElems={getVisiblePathElems}
          isFocalNode={isFocalNode}
          isPositioned={Boolean(lv)}
          operation={operation}
          setViewModifier={setViewModifier}
          service={service}
          vertexKey={key}
        />
      );
    };
  }

  private viewTraces = () => {
    const { vertexKey, getVisiblePathElems } = this.props;
    const elems = getVisiblePathElems(vertexKey);
    if (elems) {
      const urlIds: Set<string> = new Set();
      let currLength = MIN_LENGTH;
      // Because there is a limit on traceIDs, attempt to get some from each elem rather than all from one.
      const allIDs = elems.map(({ memberOf }) => memberOf.traceIDs.slice());
      while (allIDs.length) {
        const ids = allIDs.shift();
        if (ids && ids.length) {
          const id = ids.pop();
          if (id && !urlIds.has(id)) {
            // Keep track of the length, then break if it is too long, to avoid opening a tab with a URL that
            // the backend cannot process, even if there are more traceIDs
            currLength += PARAM_NAME_LENGTH + id.length;
            if (currLength > MAX_LENGTH) {
              break;
            }
            urlIds.add(id);
            if (urlIds.size >= MAX_LINKED_TRACES) {
              break;
            }
          }
          allIDs.push(ids);
        }
      }
      window.open(getSearchUrl({ traceID: Array.from(urlIds) }), '_blank');
    }
  };

  private onMouseUx = (event: React.MouseEvent<HTMLElement>) => {
    const { vertexKey, setViewModifier } = this.props;
    setViewModifier(vertexKey, EViewModifier.Hovered, event.type === 'mouseover');
  };

  render() {
    const { focalNodeUrl, isFocalNode, isPositioned, operation, service } = this.props;
    const { radius, svcWidth, opWidth, svcMarginTop } = calcPositioning(service, operation);
    const scaleFactor = RADIUS / radius;
    const transform = `translate(${RADIUS - radius}px, ${RADIUS - radius}px) scale(${scaleFactor})`;
    return (
      <div className="DdgNodeContent" onMouseOver={this.onMouseUx} onMouseOut={this.onMouseUx}>
        <div
          className={cx('DdgNodeContent--core', {
            'is-focalNode': isFocalNode,
            'is-positioned': isPositioned,
          })}
          style={{ width: `${radius * 2}px`, height: `${radius * 2}px`, transform }}
        >
          <div className="DdgNodeContent--labelWrapper">
            <h4
              className="DdgNodeContent--label"
              style={{ marginTop: `${svcMarginTop}px`, width: `${svcWidth}px` }}
            >
              <BreakableText text={service} wordRegexp={WORD_RX} />
            </h4>
            {operation && (
              <div
                className="DdgNodeContent--label"
                style={{ paddingTop: `${OP_PADDING_TOP}px`, width: `${opWidth}px` }}
              >
                <BreakableText text={operation} wordRegexp={WORD_RX} />
              </div>
            )}
          </div>
        </div>

        <div className="DdgNodeContent--actionsWrapper">
          {focalNodeUrl && (
            <a href={focalNodeUrl} className="DdgNodeContent--actionsItem">
              {setFocusIcon}
              <span className="DdgNodeContent--actionsItemText">Set focus</span>
            </a>
          )}
          <a className="DdgNodeContent--actionsItem" onClick={this.viewTraces} role="button">
            <NewWindowIcon />
            <span className="DdgNodeContent--actionsItemText">View traces</span>
          </a>
        </div>
      </div>
    );
  }
}
