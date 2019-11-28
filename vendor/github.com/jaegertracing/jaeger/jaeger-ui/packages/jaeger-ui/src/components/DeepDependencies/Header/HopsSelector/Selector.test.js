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
import { shallow } from 'enzyme';
import { Popover } from 'antd';

import { EDirection } from '../../../../model/ddg/types';
import Selector from './Selector';

describe('Selector', () => {
  const handleClick = jest.fn();
  const hops = ['full', 'partial', 'full', 'empty', 'empty'];
  const makeHops = (fullnessArr, direction = EDirection.Downstream) =>
    fullnessArr.map((fullness, i) => ({
      distance: i * direction,
      fullness,
    }));
  const props = {
    furthestDistance: 2,
    furthestFullness: 'full',
    hops: makeHops(hops),
    direction: EDirection.Downstream,
    handleClick,
  };
  let wrapper;
  function getPopoverButtons() {
    const popoverContent = wrapper.find(Popover).prop('content');
    return shallow(<div>{popoverContent}</div>).find('button');
  }

  beforeEach(() => {
    wrapper = shallow(<Selector {...props} />);
  });

  it('renders message when there are no options', () => {
    const message = shallow(<Selector hops={makeHops(['full'])} />);
    expect(message).toMatchSnapshot();
  });

  it('renders buttons with expected text and classNames', () => {
    expect(wrapper).toMatchSnapshot();
  });

  it('renders upstream hops with negative distance correctly', () => {
    const upstreamProps = {
      direction: EDirection.Upstream,
      furthestDistance: EDirection.Upstream * props.furthestDistance,
      furthestFullness: 'full',
      hops: makeHops(hops, EDirection.Upstream),
      handleClick,
    };
    const upstreamWrapper = shallow(<Selector {...upstreamProps} />);
    expect(upstreamWrapper).toMatchSnapshot();
  });

  it('calls handleClick with correct arguments from label buttons', () => {
    const buttons = wrapper.find('button');
    expect(buttons.length).toBe(2);

    buttons.first().simulate('click');
    expect(handleClick).toHaveBeenLastCalledWith(props.furthestDistance, props.direction);

    buttons.last().simulate('click');
    expect(handleClick).toHaveBeenLastCalledWith(props.hops.length - 1, props.direction);
  });

  it('calls handleClick with correct arguments from popover buttons', () => {
    const expectedDistances = [1, 0, 1, 2, 3, 4, 3];
    const popoverButtons = getPopoverButtons();
    expect(popoverButtons.length).toBe(expectedDistances.length);

    popoverButtons.forEach((btn, i) => {
      btn.simulate('click');
      expect(handleClick).toHaveBeenLastCalledWith(expectedDistances[i], props.direction);
    });
  });

  it('disables increment/decrement buttons', () => {
    wrapper.setProps({ furthestDistance: 0 });
    expect(
      getPopoverButtons()
        .first()
        .prop('disabled')
    ).toBe(true);

    wrapper.setProps({ furthestDistance: hops.length - 1 });
    expect(
      getPopoverButtons()
        .last()
        .prop('disabled')
    ).toBe(true);
  });
});
