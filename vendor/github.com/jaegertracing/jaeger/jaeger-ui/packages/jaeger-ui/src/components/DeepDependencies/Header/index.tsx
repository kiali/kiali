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
import { Icon, Input, Tooltip } from 'antd';

import HopsSelector from './HopsSelector';
import NameSelector from './NameSelector';
import LayoutSettings from './LayoutSettings';
import { trackFilter, trackShowMatches } from '../index.track';
import UiFindInput from '../../common/UiFindInput';
import { EDirection, TDdgDistanceToPathElems, TDdgVertex, EDdgDensity } from '../../../model/ddg/types';

import './index.css';

type TProps = {
  density: EDdgDensity;
  distanceToPathElems?: TDdgDistanceToPathElems;
  hiddenUiFindMatches?: Set<TDdgVertex>;
  operation?: string;
  operations: string[] | undefined;
  service?: string;
  services?: string[] | null;
  setDensity: (density: EDdgDensity) => void;
  setDistance: (distance: number, direction: EDirection) => void;
  setOperation: (operation: string) => void;
  setService: (service: string) => void;
  showOperations: boolean;
  showParameters?: boolean;
  showVertices: (vertices: TDdgVertex[]) => void;
  toggleShowOperations: (enable: boolean) => void;
  uiFindCount: number | undefined;
  visEncoding?: string;
};
export default class Header extends React.PureComponent<TProps> {
  private _uiFindInput: React.RefObject<Input> = React.createRef();

  static defaultProps = {
    showParameters: true,
  };

  focusUiFindInput = () => {
    if (this._uiFindInput.current) {
      this._uiFindInput.current.focus();
    }
  };

  getUiFindInfo = () => {
    const { hiddenUiFindMatches, uiFindCount } = this.props;

    if (uiFindCount === undefined) return null;

    let btnText = `${uiFindCount}`;
    let noMore = true;
    let tipText = 'All matches are visible';
    if (hiddenUiFindMatches && hiddenUiFindMatches.size) {
      noMore = false;
      btnText = `${uiFindCount} / ${uiFindCount + hiddenUiFindMatches.size}`;
      tipText = 'Click to view hidden matches';
    }

    return (
      <Tooltip overlayClassName="DdgHeader--uiFindInfo--tooltip" placement="topRight" title={tipText}>
        {/* arbitrary span is necessary as Tooltip alters child's styling */}
        <span>
          <button
            className="DdgHeader--uiFindInfo"
            disabled={noMore}
            onClick={this.handleInfoClick}
            type="button"
          >
            {btnText}
          </button>
        </span>
      </Tooltip>
    );
  };

  handleInfoClick = () => {
    trackShowMatches();
    const { hiddenUiFindMatches, showVertices } = this.props;
    if (hiddenUiFindMatches) showVertices(Array.from(hiddenUiFindMatches));
  };

  render() {
    const {
      density,
      distanceToPathElems,
      operation,
      operations,
      service,
      services,
      setDensity,
      setDistance,
      setOperation,
      setService,
      showOperations,
      toggleShowOperations,
      visEncoding,
      showParameters,
    } = this.props;

    return (
      <header className="DdgHeader">
        {showParameters && (
          <div className="DdgHeader--paramsHeader">
            <NameSelector
              label="Service:"
              placeholder="Select a service…"
              value={service || null}
              setValue={setService}
              required
              options={services || []}
            />
            {service && (
              <NameSelector
                label="Operation:"
                placeholder="Select an operation…"
                value={operation || null}
                setValue={setOperation}
                required
                options={operations || []}
              />
            )}
          </div>
        )}
        <div className="DdgHeader--controlHeader">
          <LayoutSettings
            density={density}
            setDensity={setDensity}
            showOperations={showOperations}
            toggleShowOperations={toggleShowOperations}
          />
          <HopsSelector
            distanceToPathElems={distanceToPathElems}
            handleClick={setDistance}
            visEncoding={visEncoding}
          />
          <div className="DdgHeader--findWrapper">
            <div className="DdgHeader--uiFind" role="button" onClick={this.focusUiFindInput}>
              <Icon className="DdgHeader--uiFindSearchIcon" type="search" />
              <UiFindInput
                allowClear
                forwardedRef={this._uiFindInput}
                inputProps={{ className: 'DdgHeader--uiFindInput' }}
                trackFindFunction={trackFilter}
              />
              {this.getUiFindInfo()}
            </div>
          </div>
        </div>
      </header>
    );
  }
}
