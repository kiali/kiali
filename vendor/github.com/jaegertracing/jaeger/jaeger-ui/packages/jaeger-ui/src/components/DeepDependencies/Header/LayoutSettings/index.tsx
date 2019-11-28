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
import { Checkbox, Popover, Radio } from 'antd';
import { CheckboxChangeEvent } from 'antd/lib/checkbox';
import { RadioChangeEvent } from 'antd/lib/radio';

import settingsIcon from './settingsIcon';
import ChevronDown from '../ChevronDown';
import { EDdgDensity } from '../../../../model/ddg/types';
import { trackDensityChange, trackToggleShowOp } from '../../index.track';

import './index.css';

type TProps = {
  density: EDdgDensity;
  setDensity: (density: EDdgDensity) => void;
  showOperations: boolean;
  toggleShowOperations: (enable: boolean) => void;
};

const cssCls = (() => {
  const CLASSNAME_PREFIX = 'Ddg--LayoutSettings';
  return (namePart?: string) => (namePart ? `${CLASSNAME_PREFIX}--${namePart}` : CLASSNAME_PREFIX);
})();

// exported for tests
export const densityOptions = [
  {
    option: EDdgDensity.MostConcise,
    title: 'One node per resource',
    note: 'Most conscise',
    description:
      "This setting represents each resource one time in the graph, regardless of whether or not it's upstream or downstream of the focal node. This results in the most desnse graph layout, possible.",
  },
  {
    option: EDdgDensity.UpstreamVsDownstream,
    title: 'Separate upstream from downstream nodes',
    description:
      'This setting differentiates upstream nodes from downstream nodes. And, within the each section, a given resource is represented by only one node.',
  },
  {
    option: EDdgDensity.OnePerLevel,
    title: 'One resource per level',
    description:
      'Represents each resource at most one time for any given level, or number of hops, from the focal node.',
  },
  {
    option: EDdgDensity.PreventPathEntanglement,
    title: 'Show paths to the focal node',
    description:
      'Each unique path to the focal node, both upstream and downstream, is represented. A resource (e.g. a service or service:operation) can be represented more than once if it is present in more than one path to the focal node.',
  },
  {
    option: EDdgDensity.ExternalVsInternal,
    title: 'Separate internal from external nodes',
    note: 'Most detailed',
    description:
      'This is similar to the setting, above, but this setting also differentiates internal from external nodes.',
  },
];

export default class LayoutSettings extends React.PureComponent<TProps> {
  private updateDensity = (event: RadioChangeEvent) => {
    const { density: prevDensity } = this.props;
    const { value: nextDensity } = event.target;
    if (prevDensity === nextDensity) return;
    trackDensityChange(prevDensity, nextDensity, densityOptions);
    this.props.setDensity(nextDensity);
  };

  private toggleShowOperations = (event: CheckboxChangeEvent) => {
    const { checked } = event.target;
    trackToggleShowOp(checked);
    this.props.toggleShowOperations(checked);
  };

  render() {
    const { density, showOperations } = this.props;
    const content = (
      <table className={cssCls('optionsTable')}>
        <tbody>
          <tr>
            <td className={cssCls('optionGroupTitle')}>Aggregations</td>
            <td>
              <Checkbox
                className={cssCls('option')}
                checked={showOperations}
                onChange={this.toggleShowOperations}
              >
                <div className={cssCls('optionDescription')}>
                  <h4>Show operations</h4>
                  <p>
                    Controls whether or not the operations are considered when creating nodes for the graph.
                    Note: The operation of the focal node is always shown.
                  </p>
                </div>
              </Checkbox>
            </td>
          </tr>
        </tbody>
        <tbody>
          {densityOptions.map((config, i) => (
            <tr key={config.option}>
              {i === 0 && (
                <td className={cssCls('optionGroupTitle')} rowSpan={densityOptions.length}>
                  Graph density
                </td>
              )}
              <td>
                <Radio
                  className={cssCls('option')}
                  onChange={this.updateDensity}
                  value={config.option}
                  checked={density === config.option}
                >
                  <div className={cssCls('optionDescription')}>
                    <h4>{config.title}</h4>
                    <p>
                      {config.note && <em className={cssCls('optionNote')}>{config.note}</em>}
                      {config.note && ' – '}
                      {config.description}
                    </p>
                  </div>
                </Radio>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    return (
      <Popover arrowPointAtCenter content={content} placement="bottomLeft" title="Layout settings">
        <div className={cssCls()}>
          {settingsIcon}
          Layout
          <ChevronDown className="ub-ml2" />
        </div>
      </Popover>
    );
  }
}
